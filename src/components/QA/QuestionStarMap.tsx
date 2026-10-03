import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Dialog from "../Common/Dialog";
import * as THREE from "three";
import { ArrowUpRight, ChevronDown, Expand, HelpCircle, Layers3, Move, Minus, Plus, RotateCcw, Search, Sparkles, X } from "lucide-react";
import type { Database } from "../../lib/database.types";
import {
	QUESTION_TOPICS,
	normalizeQuestionTopic,
	type QuestionEdge,
} from "../../services/questionService";
import { scoreBetweenQuestions } from "../../utils/questionSimilarity";

type Question = Database["public"]["Tables"]["questions"]["Row"];
type GranularityMode = "constellation" | "cluster" | "raw";
type ViewMode = "cosmos" | "list";
const MAX_RENDERED_QUESTIONS_BY_MODE: Record<GranularityMode, number> = {
	constellation: 260,
	cluster: 420,
	raw: 5000,
};

const topicColors: Record<string, number> = Object.fromEntries(QUESTION_TOPICS.map((topic) => [topic, 0xf4f1e8]));
const cosmicPalette = [0xa2acb6, 0xc7c8bf, 0xf4f1e8];

const topicCenters: Record<string, THREE.Vector3> = {
	"街头健身": new THREE.Vector3(-112, 10, 10),
	"疼痛康复": new THREE.Vector3(-72, -94, -48),
	"学习科研": new THREE.Vector3(28, 108, -42),
	"个人成长": new THREE.Vector3(124, 16, 34),
	"AI/产品": new THREE.Vector3(34, -104, 58),
	"自媒体/创业": new THREE.Vector3(96, -72, -84),
	"社区事务": new THREE.Vector3(-12, 10, 112),
	"其他": new THREE.Vector3(0, -8, -126),
};

interface StarNode {
	question: Question;
	members: Question[];
	clusterSize: number;
	totalSource: number;
	totalSame: number;
	answeredCount: number;
	topic: string;
	position: THREE.Vector3;
	size: number;
	color: THREE.Color;
	importance: number;
}

interface StarEdge {
	left: number;
	right: number;
	score: number;
	reason?: string | null;
}

interface RelatedQuestion {
	question: Question;
	score: number;
	distanceScore: number;
	reasons: string[];
}

interface QuestionStarMapProps {
	questions: Question[];
	semanticEdges?: QuestionEdge[];
	onSameQuestion: (question: Question) => void;
	loading?: boolean;
	searchQuery: string;
	onSearchQueryChange: (value: string) => void;
	selectedTopic: string | null;
	onTopicSelect: (topic: string | null) => void;
	selectedTag?: string | null;
	topicCounts?: Record<string, number>;
	onClearFilters?: () => void;
	stats?: Array<{ label: string; value: string }>;
	askPanel?: React.ReactNode;
	listPanel?: React.ReactNode;
	viewMode?: ViewMode;
	onViewModeChange?: (mode: ViewMode) => void;
	granularity?: GranularityMode;
	onGranularityChange?: (mode: GranularityMode) => void;
	totalLoadedStars?: number;
}

const granularityOptions: Array<{
	mode: GranularityMode;
	label: string;
	shortLabel: string;
	description: string;
}> = [
	{
		mode: "constellation",
		label: "星系",
		shortLabel: "星系",
		description: "几百个专题簇",
	},
	{
		mode: "cluster",
		label: "代表问题",
		shortLabel: "代表",
		description: "严格近似合并",
	},
	{
		mode: "raw",
		label: "全部星星",
		shortLabel: "全部",
		description: "逐步加载当前筛选下的全部原始问题",
	},
];

const hashString = (value: string) => {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
};

const jitter = (seed: number, offset: number) => {
	const value = Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453;
	return value - Math.floor(value);
};


const importanceFor = (question: Question) =>
	Number(question.source_count || 1) +
	Number(question.same_question_count || 0) * 1.8 +
	(question.answer ? 5 : 0) +
	(question.is_featured ? 8 : 0);

const nodeImportanceFor = (members: Question[]) =>
	members.reduce((sum, question) => sum + importanceFor(question), 0) +
	Math.log2(members.length + 1) * 10;

const sharedTagCount = (left: Question, right: Question) => {
	const leftTags = new Set(left.tags || []);
	return (right.tags || []).filter((tag) => leftTags.has(tag)).length;
};

const representativeFor = (members: Question[]) =>
	members
		.slice()
		.sort((left, right) => {
			const scoreDiff = importanceFor(right) - importanceFor(left);
			if (scoreDiff) return scoreDiff;
			return (left.content || "").length - (right.content || "").length;
		})[0];

const passesClusterThreshold = (
	edge: QuestionEdge,
	left: Question,
	right: Question,
	mode: GranularityMode,
) => {
	if (mode === "raw") return false;
	const embedding = Number(edge.embedding_similarity || 0);
	const similarity = Number(edge.similarity || 0);
	const sameTopic = left.topic && left.topic === right.topic;
	const enoughSharedTags = sharedTagCount(left, right) >= 2;

	if (mode === "constellation") {
		return embedding >= 0.82 && similarity >= 0.78 && (sameTopic || enoughSharedTags);
	}

	return embedding >= 0.88 && similarity >= 0.82 && Boolean(sameTopic);
};

const buildQuestionGroups = (
	questions: Question[],
	semanticEdges: QuestionEdge[],
	mode: GranularityMode,
) => {
	if (mode === "raw") {
		return questions.slice(0, 5000).map((question) => ({
			question,
			members: [question],
		}));
	}

	const questionById = new Map(questions.map((question) => [question.id, question]));
	const parent = new Map<string, string>();
	const find = (id: string): string => {
		if (!parent.has(id)) parent.set(id, id);
		const current = parent.get(id);
		if (current && current !== id) {
			const root = find(current);
			parent.set(id, root);
			return root;
		}
		return id;
	};
	const union = (left: string, right: string) => {
		const leftRoot = find(left);
		const rightRoot = find(right);
		if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
	};

	semanticEdges.forEach((edge) => {
		const left = questionById.get(edge.question_id);
		const right = questionById.get(edge.related_question_id);
		if (!left || !right) return;
		if (passesClusterThreshold(edge, left, right, mode)) {
			union(left.id, right.id);
		}
	});

	const components = new Map<string, Question[]>();
	parent.forEach((_, id) => {
		const root = find(id);
		const question = questionById.get(id);
		if (!question) return;
		const members = components.get(root) || [];
		members.push(question);
		components.set(root, members);
	});

	const groupedIds = new Set<string>();
	const groups = Array.from(components.values())
		.filter((members) => members.length >= 2)
		.map((members) => {
			members.forEach((member) => groupedIds.add(member.id));
			return {
				question: representativeFor(members),
				members,
			};
		});

	const singletonLimit = mode === "constellation" ? 260 : 900;
	const singletons = questions
		.filter((question) => !groupedIds.has(question.id))
		.sort((left, right) => importanceFor(right) - importanceFor(left))
		.slice(0, singletonLimit)
		.map((question) => ({
			question,
			members: [question],
		}));

	return groups
		.concat(singletons)
		.sort((left, right) => nodeImportanceFor(right.members) - nodeImportanceFor(left.members))
		.slice(0, mode === "constellation" ? 520 : 1400);
};

const colorForNode = (_baseColor: number, seed: number, importance: number, question: Question) =>
  new THREE.Color(question.answer ? 0xf4f1e8 : 0xa2acb6).multiplyScalar(0.72 + jitter(seed, 9) * 0.2 + Math.min(0.12, importance / 120));

const createGlowTexture = () => {
	const canvas = document.createElement("canvas");
	canvas.width = 64;
	canvas.height = 64;
	const context = canvas.getContext("2d");
	if (!context) return null;
	const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
	gradient.addColorStop(0, "rgba(255,255,255,1)");
	gradient.addColorStop(0.18, "rgba(255,255,255,0.92)");
	gradient.addColorStop(0.48, "rgba(255,255,255,0.34)");
	gradient.addColorStop(1, "rgba(255,255,255,0)");
	context.fillStyle = gradient;
	context.fillRect(0, 0, 64, 64);
	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
};

const buildNodes = (
	questions: Question[],
	semanticEdges: QuestionEdge[],
	mode: GranularityMode,
): StarNode[] => {
	const visibleQuestions = questions.slice(0, MAX_RENDERED_QUESTIONS_BY_MODE[mode]);
	const topicCounts = new Map<string, number>();
	visibleQuestions.forEach((question) => {
		const topic = normalizeQuestionTopic(question.topic);
		topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
	});
	const visibleIds = new Set(visibleQuestions.map((question) => question.id));
	const visibleEdges = semanticEdges.filter(
		(edge) => visibleIds.has(edge.question_id) && visibleIds.has(edge.related_question_id),
	);

	return buildQuestionGroups(visibleQuestions, visibleEdges, mode).map(({ question, members }) => {
		const topic = normalizeQuestionTopic(question.topic);
		const seed = hashString(`${question.id}-${question.content}`);
		const center = topicCenters[topic] || topicCenters["其他"];
		const topicShare = (topicCounts.get(topic) || 0) / Math.max(1, visibleQuestions.length);
		const dominantTopicSpread = Math.max(0, topicShare - 0.34);
		const adjustedCenter = dominantTopicSpread > 0
			? center.clone().lerp(new THREE.Vector3(0, center.y * 0.72, center.z * 0.72), Math.min(0.52, dominantTopicSpread * 1.25))
			: center;
		const radius = 38 + jitter(seed, 1) * (dominantTopicSpread > 0 ? 160 : 122);
		const theta = jitter(seed, 2) * Math.PI * 2;
		const phi = Math.acos(2 * jitter(seed, 3) - 1);
		const importance = nodeImportanceFor(members);
		const baseColor = topicColors[topic] || topicColors["其他"];
		const horizontalScale = 1.1 + Math.min(1.55, dominantTopicSpread * 3.5);
		const verticalScale = 0.92 + Math.min(0.26, dominantTopicSpread * 0.75);
		const nebulaBandOffset = (jitter(seed, 14) - 0.5) * Math.min(310, dominantTopicSpread * 540);
		const position = new THREE.Vector3(
			adjustedCenter.x + radius * Math.sin(phi) * Math.cos(theta) * horizontalScale + nebulaBandOffset,
			adjustedCenter.y + radius * Math.sin(phi) * Math.sin(theta) * verticalScale,
			adjustedCenter.z + radius * Math.cos(phi),
		);
		const size = Math.min(8.4, Math.max(1.15, 1.05 + Math.log2(importance + 1) * 0.9));
		return {
			question,
			members,
			clusterSize: members.length,
			totalSource: members.reduce((sum, item) => sum + Number(item.source_count || 1), 0),
			totalSame: members.reduce((sum, item) => sum + Number(item.same_question_count || 0), 0),
			answeredCount: members.filter((item) => item.answer).length,
			topic,
			position,
			size,
			importance,
			color: colorForNode(baseColor, seed, importance, question),
		};
	});
};

const buildEdges = (nodes: StarNode[]): StarEdge[] => {
	const priorityNodes = nodes
		.map((node, index) => ({ node, index }))
		.sort((left, right) => right.node.importance - left.node.importance);
	const byTopic = new Map<string, Array<{ node: StarNode; index: number }>>();

	priorityNodes.forEach((item) => {
		const topicItems = byTopic.get(item.node.topic) || [];
		if (topicItems.length < 260) {
			topicItems.push(item);
			byTopic.set(item.node.topic, topicItems);
		}
	});

	const edges: StarEdge[] = [];
	const maxPerNode = new Map<number, number>();
	byTopic.forEach((items) => {
		for (let left = 0; left < items.length; left += 1) {
			for (let right = left + 1; right < items.length; right += 1) {
				const score = scoreBetweenQuestions(
					items[left].node.question,
					items[right].node.question,
				);
				if (score < 0.32) continue;
				edges.push({
					left: items[left].index,
					right: items[right].index,
					score,
				});
			}
		}
	});

	return edges
		.sort((left, right) => right.score - left.score)
		.filter((edge) => {
			const leftCount = maxPerNode.get(edge.left) || 0;
			const rightCount = maxPerNode.get(edge.right) || 0;
			if (leftCount >= 4 || rightCount >= 4) return false;
			maxPerNode.set(edge.left, leftCount + 1);
			maxPerNode.set(edge.right, rightCount + 1);
			return true;
		})
		.slice(0, 520);
};

const buildSemanticEdges = (
	nodes: StarNode[],
	semanticEdges: QuestionEdge[] = [],
	mode: GranularityMode = "raw",
): StarEdge[] => {
	if (!semanticEdges.length) return [];
	const indexById = new Map<string, number>();
	nodes.forEach((node, index) => {
		node.members.forEach((member) => indexById.set(member.id, index));
	});
	const seen = new Set<string>();
	return semanticEdges
		.map((edge): StarEdge | null => {
			const left = indexById.get(edge.question_id);
			const right = indexById.get(edge.related_question_id);
			if (left === undefined || right === undefined || left === right) return null;
			const key = left < right ? `${left}:${right}` : `${right}:${left}`;
			if (seen.has(key)) return null;
			seen.add(key);
			return {
				left,
				right,
				score: Number(edge.similarity || edge.embedding_similarity || 0),
				reason: edge.reason,
			};
		})
		.filter((edge): edge is StarEdge => Boolean(edge))
		.sort((left, right) => right.score - left.score)
		.slice(0, mode === "constellation" ? 360 : mode === "cluster" ? 520 : 720);
};

const reasonsFor = (
	active: Question,
	candidate: Question,
	textScore: number,
	distanceScore: number,
) => {
	const reasons: string[] = [];
	if (active.topic && active.topic === candidate.topic) reasons.push("同分类");
	const activeTags = new Set(active.tags || []);
	const sharedTags = (candidate.tags || []).filter((tag) => activeTags.has(tag));
	if (sharedTags.length) reasons.push(`标签重合 ${sharedTags.slice(0, 2).join(" / ")}`);
	if (textScore >= 0.24) reasons.push("问法相似");
	if (distanceScore >= 0.62) reasons.push("星图邻近");
	if (candidate.answer) reasons.push("已回答");
	if ((candidate.source_count || 0) > 1) reasons.push("多来源");
	return reasons.slice(0, 4);
};

const buildRelatedQuestions = (
	activeQuestion: Question | null,
	nodes: StarNode[],
	semanticEdges: QuestionEdge[] = [],
): RelatedQuestion[] => {
	if (!activeQuestion) return [];
	const nodeByMemberId = new Map<string, StarNode>();
	nodes.forEach((node) => {
		node.members.forEach((member) => nodeByMemberId.set(member.id, node));
	});
	const activeNode = nodeByMemberId.get(activeQuestion.id) ||
		nodes.find((node) => node.question.id === activeQuestion.id);
	if (!activeNode) return [];
	const activeMemberIds = new Set(activeNode.members.map((member) => member.id));

	const semanticRelated = semanticEdges
		.map((edge) => {
			let relatedId: string | null = null;
			if (activeMemberIds.has(edge.question_id)) {
				relatedId = edge.related_question_id;
			} else if (activeMemberIds.has(edge.related_question_id)) {
				relatedId = edge.question_id;
			}
			if (!relatedId) return null;
			const node = nodeByMemberId.get(relatedId);
			if (!node || node.question.id === activeNode.question.id) return null;
			const distance = activeNode.position.distanceTo(node.position);
			const distanceScore = Math.max(0, 1 - distance / 210);
			return {
				question: node.question,
				score: Number(edge.similarity || edge.embedding_similarity || 0),
				distanceScore,
				reasons: edge.reason
					? edge.reason.split(" · ").slice(0, 4)
					: reasonsFor(activeQuestion, node.question, 0.32, distanceScore),
			};
		})
		.filter((item): item is RelatedQuestion => Boolean(item))
		.sort((left, right) => right.score - left.score);

	if (semanticRelated.length) {
		const seen = new Set<string>();
		return semanticRelated
			.filter((item) => {
				if (seen.has(item.question.id)) return false;
				seen.add(item.question.id);
				return true;
			})
			.slice(0, 6);
	}

	return nodes
		.filter((node) => node.question.id !== activeQuestion.id)
		.map((node) => {
			const textScore = scoreBetweenQuestions(activeQuestion, node.question);
			const distance = activeNode
				? activeNode.position.distanceTo(node.position)
				: 240;
			const distanceScore = Math.max(0, 1 - distance / 210);
			const score = Math.min(
				1,
				textScore * 0.74 +
					distanceScore * 0.26 +
					(activeQuestion.topic && activeQuestion.topic === node.question.topic ? 0.04 : 0),
			);
			return {
				question: node.question,
				score,
				distanceScore,
				reasons: reasonsFor(activeQuestion, node.question, textScore, distanceScore),
			};
		})
		.filter((item) => item.score >= 0.2 || item.distanceScore >= 0.68)
		.sort((left, right) => right.score - left.score)
		.slice(0, 6);
};

const QuestionStarMap: React.FC<QuestionStarMapProps> = ({
	questions,
	semanticEdges = [],
	onSameQuestion,
	loading = false,
	searchQuery,
	onSearchQueryChange,
	selectedTopic,
	onTopicSelect,
	selectedTag = null,
	topicCounts,
	onClearFilters,
	stats = [],
	askPanel,
	listPanel,
	viewMode = "cosmos",
	onViewModeChange,
	granularity = "constellation",
	onGranularityChange,
	totalLoadedStars,
}) => {
  const location = useLocation();
  const sceneApiRef = useRef<{ focus: (id: string) => void; reset: () => void; zoom: (delta: number) => void } | null>(null);
  const selectedQuestionRef = useRef<string | null>(null);
  const interactionModeRef = useRef<"rotate" | "pan">("rotate");
  const cameraStateRef = useRef({ rotationX: 0, rotationY: 0, panX: 0, panY: 0, cameraZ: 0 });
  const [showHelp, setShowHelp] = useState(false);
  const [showRelated, setShowRelated] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const mountRef = useRef<HTMLDivElement | null>(null);
	const frameRef = useRef<number | null>(null);
	const [selected, setSelected] = useState<Question | null>(questions[0] || null);
	const [hovered, setHovered] = useState<Question | null>(null);
	const [zoomLabel, setZoomLabel] = useState("1.0x");
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [isDetailOpen, setIsDetailOpen] = useState(false);
	const [interactionMode, setInteractionMode] = useState<"rotate" | "pan">("rotate");
	const [isAskOpen, setIsAskOpen] = useState(false);
	const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(null);

	const nodes = useMemo(
		() => buildNodes(questions, semanticEdges, granularity),
		[questions, semanticEdges, granularity],
	);
	const edges = useMemo(() => {
		const cached = buildSemanticEdges(nodes, semanticEdges, granularity);
		return cached.length ? cached : buildEdges(nodes);
	}, [nodes, semanticEdges, granularity]);
	const activeQuestion = selected || nodes[0]?.question || null;
	const activeNode = activeQuestion
		? nodes.find((node) => node.question.id === activeQuestion.id)
		: null;
	const relatedQuestions = useMemo(
		() => buildRelatedQuestions(activeQuestion, nodes, semanticEdges),
		[activeQuestion, nodes, semanticEdges],
	);

	useEffect(() => {
		if (selected && nodes.some((node) => node.question.id === selected.id)) return;
    setSelected(nodes[0]?.question || null);
    setIsDetailOpen(false);
    setFocusedQuestionId(null);
	}, [nodes, selected]);

  useEffect(() => { selectedQuestionRef.current = focusedQuestionId; }, [focusedQuestionId]);
  useEffect(() => { interactionModeRef.current = interactionMode; }, [interactionMode]);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape' && !(event.target instanceof Element && event.target.closest('dialog[open]'))) { setIsFullscreen(false); setShowHelp(false); setIsDetailOpen(false); } };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, []);
  useEffect(() => {
    if (!isFullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isFullscreen]);

  const selectQuestion = (question: Question) => {
    setSelected(question); setIsDetailOpen(true); setFocusedQuestionId(question.id);
    sceneApiRef.current?.focus(question.id);
  };

	useEffect(() => {
		const mount = mountRef.current;
		if (!mount) return;

		const scene = new THREE.Scene();
		scene.fog = new THREE.FogExp2(0x0a0f14, 0.0019);

    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setRenderError(true); return; }
    setRenderError(false);
    renderer.domElement.setAttribute('aria-label', '三维问题星图，拖动旋转，滚轮缩放；也可切换列表阅读');
    renderer.domElement.setAttribute('role', 'img');
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
		renderer.setSize(mount.clientWidth, mount.clientHeight);
		mount.replaceChildren(renderer.domElement);

		const camera = new THREE.PerspectiveCamera(
			56,
			mount.clientWidth / mount.clientHeight,
			0.1,
			1400,
		);
		const baseCameraZ = mount.clientWidth < 600 ? 520 : granularity === "constellation" ? 350 : granularity === "cluster" ? 390 : 430;
		camera.position.set(0, 0, baseCameraZ);

		const group = new THREE.Group();
		scene.add(group);

		scene.add(new THREE.AmbientLight(0xffffff, 0.92));
		const point = new THREE.PointLight(0xf4f1e8, 1.35, 900);
		point.position.set(80, 130, 220);
		scene.add(point);

		const nebulaGeometry = new THREE.BufferGeometry();
		const nebulaPositions: number[] = [];
		const nebulaColors: number[] = [];
		const nebulaSizes: number[] = [];
		for (let index = 0; index < 1400; index += 1) {
			const seed = index + 911;
			const band = index % 4;
			const centerX = band === 0 ? -170 : band === 1 ? 110 : band === 2 ? 10 : -40;
			const centerY = band === 0 ? 55 : band === 1 ? -80 : band === 2 ? 120 : -130;
			const centerZ = band === 0 ? -170 : band === 1 ? 110 : band === 2 ? 40 : -70;
			const spread = band === 2 ? 260 : 190;
			const color = new THREE.Color(
				0xa2acb6,
			).lerp(new THREE.Color(0xffffff), 0.12 + jitter(seed, 8) * 0.22);
			nebulaPositions.push(
				centerX + (jitter(seed, 1) - 0.5) * spread * 2.4,
				centerY + (jitter(seed, 2) - 0.5) * spread * 1.35,
				centerZ + (jitter(seed, 3) - 0.5) * spread * 1.8,
			);
			nebulaColors.push(color.r, color.g, color.b);
			nebulaSizes.push(10 + jitter(seed, 4) * 34);
		}
		nebulaGeometry.setAttribute(
			"position",
			new THREE.Float32BufferAttribute(nebulaPositions, 3),
		);
		nebulaGeometry.setAttribute(
			"color",
			new THREE.Float32BufferAttribute(nebulaColors, 3),
		);
		nebulaGeometry.setAttribute(
			"size",
			new THREE.Float32BufferAttribute(nebulaSizes, 1),
		);
		const nebulaMaterial = new THREE.ShaderMaterial({
			vertexShader: `
				attribute float size;
				varying vec3 vColor;
				void main() {
					vColor = color;
					vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
					gl_PointSize = size * (260.0 / max(120.0, -mvPosition.z));
					gl_Position = projectionMatrix * mvPosition;
				}
			`,
			fragmentShader: `
				varying vec3 vColor;
				void main() {
					vec2 uv = gl_PointCoord - vec2(0.5);
					float dist = length(uv);
					float alpha = smoothstep(0.5, 0.0, dist) * 0.045;
					if (alpha < 0.006) discard;
					gl_FragColor = vec4(vColor, alpha);
				}
			`,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			vertexColors: true,
			toneMapped: false,
		});
		const nebula = new THREE.Points(nebulaGeometry, nebulaMaterial);
		scene.add(nebula);

		const starGeometry = new THREE.BufferGeometry();
		const starPositions: number[] = [];
		const starColors: number[] = [];
		const starSizes: number[] = [];
		nodes.forEach((node, index) => {
			const twinkle = 1 + jitter(hashString(`${node.question.id}-${index}`), 12) * 0.62;
			starPositions.push(node.position.x, node.position.y, node.position.z);
			starColors.push(node.color.r, node.color.g, node.color.b);
			starSizes.push(node.size * 2.4 * twinkle);
		});
		starGeometry.setAttribute(
			"position",
			new THREE.Float32BufferAttribute(starPositions, 3),
		);
		starGeometry.setAttribute(
			"color",
			new THREE.Float32BufferAttribute(starColors, 3),
		);
		starGeometry.setAttribute(
			"size",
			new THREE.Float32BufferAttribute(starSizes, 1),
		);
		const starMaterial = new THREE.ShaderMaterial({
			uniforms: {
				pixelRatio: { value: Math.min(window.devicePixelRatio, 1.8) },
			},
			vertexShader: `
				attribute float size;
				varying vec3 vColor;
				void main() {
					vColor = color;
					vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
					gl_PointSize = size * (320.0 / max(80.0, -mvPosition.z));
					gl_Position = projectionMatrix * mvPosition;
				}
			`,
			fragmentShader: `
				varying vec3 vColor;
				void main() {
					vec2 uv = gl_PointCoord - vec2(0.5);
					float dist = length(uv);
					float core = smoothstep(0.2, 0.0, dist);
					float halo = smoothstep(0.5, 0.02, dist) * 0.42;
					float sparkle = smoothstep(0.075, 0.0, abs(uv.x)) * smoothstep(0.48, 0.0, abs(uv.y)) * 0.24;
					vec3 color = mix(vColor, vec3(1.0), core * 0.62);
					float alpha = max(core, halo) + sparkle;
					if (alpha < 0.018) discard;
					gl_FragColor = vec4(color, min(alpha, 1.0));
				}
			`,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			vertexColors: true,
			toneMapped: false,
		});
		const starPoints = new THREE.Points(starGeometry, starMaterial);
		group.add(starPoints);

		const satelliteGeometry = new THREE.BufferGeometry();
		const satellitePositions: number[] = [];
		const satelliteColors: number[] = [];
		const satelliteSizes: number[] = [];
		nodes.forEach((node, nodeIndex) => {
			if (node.clusterSize <= 1) return;
			const seed = hashString(`${node.question.id}-satellites`);
			const satelliteCount = Math.min(
				90,
				Math.max(6, Math.round(Math.sqrt(node.clusterSize) * 5.8)),
			);
			const cloudRadius = Math.min(
				42,
				Math.max(12, 7 + Math.log2(node.clusterSize + 1) * 6.2),
			);
			for (let index = 0; index < satelliteCount; index += 1) {
				const radius = cloudRadius * (0.25 + jitter(seed + index, 1) * 0.9);
				const theta = jitter(seed + index, 2) * Math.PI * 2;
				const phi = Math.acos(2 * jitter(seed + index, 3) - 1);
				const color = node.color
					.clone()
					.lerp(
						new THREE.Color(cosmicPalette[(seed + index + nodeIndex) % cosmicPalette.length]),
						0.18 + jitter(seed + index, 4) * 0.48,
					)
					.lerp(new THREE.Color(0xffffff), 0.16);
				satellitePositions.push(
					node.position.x + radius * Math.sin(phi) * Math.cos(theta),
					node.position.y + radius * Math.sin(phi) * Math.sin(theta),
					node.position.z + radius * Math.cos(phi),
				);
				satelliteColors.push(color.r, color.g, color.b);
				satelliteSizes.push(3.4 * (0.7 + jitter(seed + index, 5) * 0.9));
			}
		});
		satelliteGeometry.setAttribute(
			"position",
			new THREE.Float32BufferAttribute(satellitePositions, 3),
		);
		satelliteGeometry.setAttribute(
			"color",
			new THREE.Float32BufferAttribute(satelliteColors, 3),
		);
		satelliteGeometry.setAttribute(
			"size",
			new THREE.Float32BufferAttribute(satelliteSizes, 1),
		);
		const satelliteMaterial = starMaterial.clone();
		satelliteMaterial.transparent = true;
		const satellitePoints = new THREE.Points(satelliteGeometry, satelliteMaterial);
		group.add(satellitePoints);

		const glowGeometry = new THREE.BufferGeometry();
		const glowPositions: number[] = [];
		const glowColors: number[] = [];
		nodes.forEach((node) => {
			glowPositions.push(node.position.x, node.position.y, node.position.z);
			glowColors.push(node.color.r, node.color.g, node.color.b);
		});
		glowGeometry.setAttribute(
			"position",
			new THREE.Float32BufferAttribute(glowPositions, 3),
		);
		glowGeometry.setAttribute(
			"color",
			new THREE.Float32BufferAttribute(glowColors, 3),
		);
		const glowTexture = createGlowTexture();
		const glowMaterial = new THREE.PointsMaterial({
			size: 2,
			sizeAttenuation: true,
			vertexColors: true,
			map: glowTexture || undefined,
			alphaTest: 0.02,
			transparent: true,
			opacity: 0.26,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			toneMapped: false,
		});
		const glow = new THREE.Points(glowGeometry, glowMaterial);
		group.add(glow);

		const edgePositions: number[] = [];
		const edgeColors: number[] = [];
		edges.forEach((edge) => {
			const left = nodes[edge.left];
			const right = nodes[edge.right];
			edgePositions.push(
				left.position.x,
				left.position.y,
				left.position.z,
				right.position.x,
				right.position.y,
				right.position.z,
			);
			const edgeColor = left.color.clone().lerp(new THREE.Color(0xffffff), 0.18);
			for (let index = 0; index < 2; index += 1) {
				edgeColors.push(edgeColor.r, edgeColor.g, edgeColor.b);
			}
		});
		const edgeGeometry = new THREE.BufferGeometry();
		edgeGeometry.setAttribute(
			"position",
			new THREE.Float32BufferAttribute(edgePositions, 3),
		);
		edgeGeometry.setAttribute(
			"color",
			new THREE.Float32BufferAttribute(edgeColors, 3),
		);
		const edgeMaterial = new THREE.LineBasicMaterial({
			vertexColors: true,
			transparent: true,
			opacity: granularity === "constellation" ? 0.06 : granularity === "cluster" ? 0.09 : 0.07,
			blending: THREE.AdditiveBlending,
		});
		group.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));

		const dustGeometry = new THREE.BufferGeometry();
		const dustPositions: number[] = [];
		const dustColors: number[] = [];
		const dustSizes: number[] = [];
		for (let index = 0; index < 3600; index += 1) {
			const seed = index + 17;
			const color = new THREE.Color(
				cosmicPalette[(seed + Math.floor(jitter(seed, 8) * cosmicPalette.length)) % cosmicPalette.length],
			).lerp(new THREE.Color(0xffffff), 0.42 + jitter(seed, 9) * 0.32);
			dustPositions.push(
				(jitter(seed, 1) - 0.5) * 900,
				(jitter(seed, 2) - 0.5) * 620,
				(jitter(seed, 3) - 0.5) * 820,
			);
			dustColors.push(color.r, color.g, color.b);
			dustSizes.push(0.75 + jitter(seed, 10) * 1.15);
		}
		dustGeometry.setAttribute(
			"position",
			new THREE.Float32BufferAttribute(dustPositions, 3),
		);
		dustGeometry.setAttribute(
			"color",
			new THREE.Float32BufferAttribute(dustColors, 3),
		);
		dustGeometry.setAttribute(
			"size",
			new THREE.Float32BufferAttribute(dustSizes, 1),
		);
		const dust = new THREE.Points(
			dustGeometry,
			new THREE.PointsMaterial({
				color: 0xa2acb6,
				size: 1.15,
				vertexColors: true,
				transparent: true,
				opacity: 0.18,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
			}),
		);
		scene.add(dust);

		const raycaster = new THREE.Raycaster();
		raycaster.params.Points = { threshold: 11 };
		const pointer = new THREE.Vector2();
		let targetRotationX = 0;
		let targetRotationY = 0;
		let targetPanX = 0;
		let targetPanY = 0;
		let targetCameraZ = baseCameraZ;
		let isDragging = false;
		let dragMode: "rotate" | "pan" = "rotate";
		let dragMoved = 0;
		let lastX = 0;
		let lastY = 0;
		const savedCamera = cameraStateRef.current;
    if (savedCamera.cameraZ) {
      targetRotationX = savedCamera.rotationX; targetRotationY = savedCamera.rotationY;
      targetPanX = savedCamera.panX; targetPanY = savedCamera.panY; targetCameraZ = savedCamera.cameraZ;
      group.rotation.set(targetRotationX, targetRotationY, 0); group.position.set(targetPanX, targetPanY, 0); camera.position.z = targetCameraZ;
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		const updatePointer = (event: PointerEvent) => {
			const rect = renderer.domElement.getBoundingClientRect();
			pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
			pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
		};

		const pickQuestion = () => {
			raycaster.setFromCamera(pointer, camera);
			const intersections = raycaster.intersectObject(starPoints);
			const pointIndex = intersections[0]?.index;
			if (typeof pointIndex !== "number") return null;
			const node = nodes[pointIndex];
			return node ? { node, question: node.question } : null;
		};

		const focusNode = (node: StarNode) => {
			const focusZoom = mount.clientWidth < 600 ? 290 : 210;
			targetPanX = Math.max(-260, Math.min(260, -node.position.x * 0.88));
			targetPanY = Math.max(-190, Math.min(190, -node.position.y * 0.88));
			targetRotationX = Math.max(-0.72, Math.min(0.72, -node.position.y / 360));
			targetRotationY = Math.max(-1.1, Math.min(1.1, node.position.x / 330));
			targetCameraZ = focusZoom;
			setZoomLabel(`${(baseCameraZ / targetCameraZ).toFixed(1)}x`);
		};

    const highlightNode = (id: string | null) => {
      const activeIndex = nodes.findIndex((node) => node.question.id === id);
      const related = new Set<number>();
      edges.forEach((edge) => { if (edge.left === activeIndex) related.add(edge.right); if (edge.right === activeIndex) related.add(edge.left); });
      const colors = starGeometry.getAttribute('color');
      nodes.forEach((node,index) => { const color = activeIndex < 0 ? node.color : index === activeIndex || related.has(index) ? new THREE.Color(0xff603d) : node.color.clone().multiplyScalar(0.28); colors.setXYZ(index,color.r,color.g,color.b); });
      colors.needsUpdate = true;
      const lineColors = edgeGeometry.getAttribute('color');
      edges.forEach((edge,index) => { const color = new THREE.Color(activeIndex >= 0 && (edge.left === activeIndex || edge.right === activeIndex) ? 0xff603d : 0x5c6268); for (let endpoint=0;endpoint<2;endpoint++) lineColors.setXYZ(index*2+endpoint,color.r,color.g,color.b); });
      lineColors.needsUpdate = true;
    };
    highlightNode(selectedQuestionRef.current);
    sceneApiRef.current = {
      focus: (id) => { const node = nodes.find((item) => item.question.id === id); if (node) { focusNode(node); highlightNode(id); } },
      reset: () => { targetRotationX=0; targetRotationY=0; targetPanX=0; targetPanY=0; targetCameraZ=baseCameraZ; setZoomLabel('1.0x'); setFocusedQuestionId(null); highlightNode(null); },
      zoom: (delta) => { targetCameraZ = Math.max(120,Math.min(620,targetCameraZ+delta)); setZoomLabel((baseCameraZ/targetCameraZ).toFixed(1)+'x'); },
    };

		const handlePointerDown = (event: PointerEvent) => {
			isDragging = true;
			dragMode = interactionModeRef.current === "pan" || event.shiftKey || event.altKey || event.button === 1 || event.button === 2
				? "pan"
				: "rotate";
			dragMoved = 0;
			lastX = event.clientX;
			lastY = event.clientY;
			renderer.domElement.setPointerCapture(event.pointerId);
			renderer.domElement.style.cursor = dragMode === "pan" ? "move" : "grabbing";
		};

		const handlePointerMove = (event: PointerEvent) => {
			updatePointer(event);
			if (isDragging) {
				const dx = event.clientX - lastX;
				const dy = event.clientY - lastY;
				if (dragMode === "pan") {
					const zoomScale = camera.position.z / baseCameraZ;
					targetPanX = Math.max(-210, Math.min(210, targetPanX + dx * 0.62 * zoomScale));
					targetPanY = Math.max(-150, Math.min(150, targetPanY - dy * 0.62 * zoomScale));
				} else {
					targetRotationY += dx * 0.0048;
					targetRotationX += dy * 0.0032;
					targetRotationX = Math.max(-0.95, Math.min(0.95, targetRotationX));
				}
				dragMoved += Math.abs(dx) + Math.abs(dy);
				lastX = event.clientX;
				lastY = event.clientY;
				return;
			}
			const picked = pickQuestion();
			setHovered(picked?.question || null);
			renderer.domElement.style.cursor = interactionModeRef.current === "pan"
				? "move"
				: picked
					? "pointer"
					: "grab";
		};

		const handlePointerUp = (event: PointerEvent) => {
			updatePointer(event);
			if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
			isDragging = false;
			dragMode = "rotate";
			renderer.domElement.style.cursor = "grab";
			if (event.type !== "pointercancel" && dragMoved < 8) {
				const picked = pickQuestion();
				if (picked) {
					focusNode(picked.node);
          highlightNode(picked.question.id);
					setFocusedQuestionId(picked.question.id);
					setSelected(picked.question);
					setIsDetailOpen(true);
				}
			}
		};

		const handleWheel = (event: WheelEvent) => {
			event.preventDefault();
			targetCameraZ = Math.max(
				120,
				Math.min(620, targetCameraZ + event.deltaY * 0.42),
			);
			setZoomLabel(`${(baseCameraZ / targetCameraZ).toFixed(1)}x`);
		};

		const handleContextMenu = (event: MouseEvent) => {
			event.preventDefault();
		};

		const handleResize = () => {
			if (!mount.clientWidth || !mount.clientHeight) return;
			camera.aspect = mount.clientWidth / mount.clientHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(mount.clientWidth, mount.clientHeight);
		};

		renderer.domElement.addEventListener("pointerdown", handlePointerDown);
		renderer.domElement.addEventListener("pointermove", handlePointerMove);
		renderer.domElement.addEventListener("pointerup", handlePointerUp);
		renderer.domElement.addEventListener("wheel", handleWheel, { passive: false });
		renderer.domElement.addEventListener("contextmenu", handleContextMenu);
		window.addEventListener("resize", handleResize);
    const resizeObserver = new ResizeObserver(handleResize); resizeObserver.observe(mount);
    renderer.domElement.addEventListener("pointercancel", handlePointerUp);

		const animate = () => {
      const ease = reducedMotion ? 1 : 0.1;
      group.rotation.y += (targetRotationY-group.rotation.y)*ease;
      group.rotation.x += (targetRotationX-group.rotation.x)*ease;
      group.position.x += (targetPanX-group.position.x)*ease;
      group.position.y += (targetPanY-group.position.y)*ease;
      camera.position.z += (targetCameraZ-camera.position.z)*ease;
      cameraStateRef.current = { rotationX: targetRotationX, rotationY: targetRotationY, panX: targetPanX, panY: targetPanY, cameraZ: targetCameraZ };
      mount.dataset.camera = [group.rotation.x,group.rotation.y,group.position.x,group.position.y,camera.position.z].map((value) => value.toFixed(2)).join(',');
			renderer.render(scene, camera);
			frameRef.current = requestAnimationFrame(animate);
		};
		animate();

		return () => {
			if (frameRef.current) cancelAnimationFrame(frameRef.current);
			renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
			renderer.domElement.removeEventListener("pointermove", handlePointerMove);
			renderer.domElement.removeEventListener("pointerup", handlePointerUp);
			renderer.domElement.removeEventListener("wheel", handleWheel);
			renderer.domElement.removeEventListener("contextmenu", handleContextMenu);
			window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect(); sceneApiRef.current=null;
      renderer.domElement.removeEventListener("pointercancel", handlePointerUp);
			starGeometry.dispose();
			starMaterial.dispose();
			satelliteGeometry.dispose();
			satelliteMaterial.dispose();
			glowGeometry.dispose();
			glowMaterial.dispose();
			glowTexture?.dispose();
			edgeGeometry.dispose();
			edgeMaterial.dispose();
			nebulaGeometry.dispose();
			nebulaMaterial.dispose();
			dustGeometry.dispose();
			(dust.material as THREE.Material).dispose();
			renderer.dispose();
			mount.replaceChildren();
		};
	}, [nodes, edges, granularity]);

  return <section className={isFullscreen ? 'planet-page planet-fullscreen' : 'planet-page'}>
    <header className="page-heading planet-heading"><h1>问题星球</h1><div className="planet-heading-actions"><div className="planet-switch" aria-label="浏览方式"><button type="button" aria-pressed={viewMode === 'cosmos'} onClick={() => onViewModeChange?.('cosmos')}><Sparkles size={22} />星图</button><button type="button" aria-pressed={viewMode === 'list'} onClick={() => onViewModeChange?.('list')}><Layers3 size={22} />列表</button></div><button type="button" className="jw-action" onClick={() => setIsAskOpen(true)}><Plus />提问</button></div></header>
    <div className="planet-search-row"><label className="planet-search"><Search aria-hidden="true" /><input aria-label="搜索问题" value={searchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} placeholder="搜索你正在想的问题" />{searchQuery && <button type="button" aria-label="清空搜索" onClick={() => onSearchQueryChange('')}><X size={20} /></button>}</label><select aria-label="问题分类" value={selectedTopic || ''} onChange={(event) => onTopicSelect(event.target.value || null)}><option value="">全部</option>{QUESTION_TOPICS.map((topic) => <option key={topic} value={topic}>{topic}{topicCounts?.[topic] ? ' · '+topicCounts[topic] : ''}</option>)}</select></div>
    <div className="planet-workspace" data-selected-question={focusedQuestionId || undefined} style={viewMode === 'list' ? {display:'none'} : undefined}>
      <img className="planet-background" src="/images/question-cosmos-nebula.png" alt="" />
      <div ref={mountRef} className="planet-mount" />
      {!isDetailOpen && <div className="planet-intro"><h2>从一个问题，<br />探索更多可能。</h2><p>拖动探索 · 点击星星查看问题</p></div>}
      {hovered && !isDetailOpen && <div className="planet-hover">{hovered.content.slice(0,55)}</div>}
      {loading && !nodes.length ? <p role="status" className="planet-status">正在加载星图…</p> : renderError ? <div className="planet-status">当前设备无法显示 3D 星图<button type="button" onClick={() => onViewModeChange?.('list')}>使用问题列表</button></div> : !nodes.length && <div className="planet-status">没有找到匹配的问题<button type="button" onClick={onClearFilters}>清空筛选</button></div>}
      {isDetailOpen && activeQuestion && <aside className="planet-preview" aria-label="选中的问题">
        <div className="planet-preview-top"><span>{activeNode?.topic || activeQuestion.topic} · {activeQuestion.answer ? '已有回答' : '等待回答'}</span><button type="button" aria-label="关闭问题预览" onClick={() => {setIsDetailOpen(false);setShowRelated(false);}}><X size={22} /></button></div>
        <h2>{activeQuestion.content}</h2>
        <div className="planet-preview-actions"><Link to={'/qa/'+activeQuestion.id} state={{planetBackground:location}} className="preview-read">查看问题 <ArrowUpRight size={20} /></Link><button type="button" className="preview-follow" onClick={() => onSameQuestion(activeQuestion)}><Plus size={18} />我也想问</button></div>
        <button type="button" className="related-toggle" aria-expanded={showRelated} onClick={() => setShowRelated(!showRelated)}>关联问题 · {relatedQuestions.length}<ChevronDown size={20} /></button>
        {showRelated && <div className="planet-related">{relatedQuestions.length ? relatedQuestions.map((item) => <button type="button" key={item.question.id} onClick={() => selectQuestion(item.question)}>{item.question.content}</button>) : <p>暂未发现关联问题</p>}</div>}
      </aside>}
      <div className="planet-bottom"><span>{nodes.length} 颗星 · {stats.find((item) => item.label === '收录问题')?.value || totalLoadedStars || questions.length} 个问题{selectedTag ? ' · #'+selectedTag : ''}</span><div className="planet-controls"><button type="button" aria-label="缩小星图" onClick={() => sceneApiRef.current?.zoom(70)}><Minus size={20} /></button><span>{zoomLabel}</span><button type="button" aria-label="放大星图" onClick={() => sceneApiRef.current?.zoom(-70)}><Plus size={20} /></button><button type="button" aria-label="重置视角" onClick={() => {sceneApiRef.current?.reset();setIsDetailOpen(false);}}><RotateCcw size={20} /></button><button type="button" aria-label="平移模式" aria-pressed={interactionMode === 'pan'} onClick={() => setInteractionMode(interactionMode === 'pan' ? 'rotate':'pan')}><Move size={20} /></button><button type="button" aria-label={isFullscreen ? '退出全屏' : '全屏探索'} aria-pressed={isFullscreen} onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <X size={20} /> : <Expand size={20} />}</button><button type="button" aria-label="星图设置与帮助" aria-expanded={showHelp} onClick={() => setShowHelp(!showHelp)}><HelpCircle size={20} /></button></div></div>
      {showHelp && <div className="planet-help"><p>拖动旋转星图，滚轮或加减按钮缩放。开启平移后，拖动移动视角。</p><p>点击星星查看问题。阅读后关闭窗口，继续从当前位置探索。</p><label>星图密度<select aria-label="星图密度" value={granularity} onChange={(event) => onGranularityChange?.(event.target.value as GranularityMode)}>{granularityOptions.map((option) => <option key={option.mode} value={option.mode}>{option.label}</option>)}</select></label></div>}
    </div>
    {viewMode === 'list' && <div className="planet-list-container">{listPanel}</div>}
    {isAskOpen && <Dialog title="提交问题" onClose={() => setIsAskOpen(false)}>{askPanel}</Dialog>}
  </section>;
};
export default QuestionStarMap;
