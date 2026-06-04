import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import {
	ArrowUpRight,
	CheckCircle,
	ChevronRight,
	Expand,
	Layers3,
	Maximize2,
	MessageSquareText,
	Move,
	MousePointer2,
	Network,
	RotateCcw,
	Sparkles,
	X,
} from "lucide-react";
import type { Database } from "../../lib/database.types";
import { normalizeQuestionTopic, type QuestionEdge } from "../../services/questionService";
import { scoreBetweenQuestions } from "../../utils/questionSimilarity";

type Question = Database["public"]["Tables"]["questions"]["Row"];
type GranularityMode = "constellation" | "cluster" | "raw";

const topicColors: Record<string, number> = {
	"街头健身": 0x20e8ff,
	"疼痛康复": 0x4ade80,
	"学习科研": 0x7dd3fc,
	"个人成长": 0xfb70c8,
	"AI/产品": 0xb98cff,
	"自媒体/创业": 0xffcf5a,
	"社区事务": 0xff7a9e,
	"其他": 0xcbd5e1,
};

const cosmicPalette = [
	0x22d3ee,
	0x38bdf8,
	0x60a5fa,
	0x818cf8,
	0xa78bfa,
	0xe879f9,
	0xf472b6,
	0xfb7185,
	0xfbbf24,
	0x4ade80,
	0x2dd4bf,
	0xfef08a,
];

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

const topicStarNames: Record<string, string> = {
	"街头健身": "力场星",
	"疼痛康复": "复原星",
	"学习科研": "研读星",
	"个人成长": "心智星",
	"AI/产品": "智造星",
	"自媒体/创业": "流量星",
	"社区事务": "群落星",
	"其他": "未名星",
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
}

const granularityOptions: Array<{
	mode: GranularityMode;
	label: string;
	description: string;
}> = [
	{
		mode: "constellation",
		label: "星系",
		description: "几百个专题簇",
	},
	{
		mode: "cluster",
		label: "代表问题",
		description: "严格近似合并",
	},
	{
		mode: "raw",
		label: "全部星星",
		description: "原始问题",
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

const shortCodeFor = (value: string) =>
	hashString(value).toString(36).slice(0, 3).toUpperCase();

const safeOwnerName = (question: Question) => {
	const nickname = question.asker_nickname?.trim();
	if (
		!nickname ||
		question.is_imported ||
		question.is_anonymous ||
		nickname === "匿名用户"
	) {
		return null;
	}

	const withoutPrivateParts = nickname
		.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
		.replace(/\d{4,}/g, "");
	const clean = withoutPrivateParts
		.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, "")
		.slice(0, 8);
	return clean || null;
};

const starNameFor = (question: Question) => {
	const topic = normalizeQuestionTopic(question.topic);
	const seed = `${question.id}-${question.content}`;
	const owner = safeOwnerName(question);
	const base = topicStarNames[topic] || topicStarNames["其他"];
	const primaryTag = question.tags?.[0]?.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").slice(0, 5);
	const suffix = shortCodeFor(seed);

	if (owner) {
		return `${owner}的${primaryTag || base}-${suffix}`;
	}

	return `${primaryTag || base}-${suffix}`;
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

const colorForNode = (
	baseColor: number,
	seed: number,
	importance: number,
	question: Question,
) => {
	const tagSeed = hashString(`${question.topic || ""}-${(question.tags || []).slice(0, 3).join("-")}`);
	const accent = new THREE.Color(cosmicPalette[tagSeed % cosmicPalette.length]);
	const color = new THREE.Color(baseColor).lerp(accent, 0.38 + jitter(seed, 9) * 0.44);
	const hsl = { h: 0, s: 0, l: 0 };
	color.getHSL(hsl);
	hsl.h = (hsl.h + (jitter(seed, 4) - 0.5) * 0.18 + 1) % 1;
	hsl.s = Math.min(1, Math.max(0.68, hsl.s + (jitter(seed, 5) - 0.5) * 0.18));
	hsl.l = Math.min(
		0.9,
		Math.max(
			0.5,
			hsl.l +
				(jitter(seed, 6) - 0.5) * 0.18 +
				Math.min(0.18, Math.log2(importance + 1) * 0.016) +
				(question.answer ? 0.05 : 0),
		),
	);
	return new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l);
};

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
): StarNode[] =>
	buildQuestionGroups(questions, semanticEdges, mode).map(({ question, members }) => {
		const topic = normalizeQuestionTopic(question.topic);
		const seed = hashString(`${question.id}-${question.content}`);
		const center = topicCenters[topic] || topicCenters["其他"];
		const radius = 34 + jitter(seed, 1) * 112;
		const theta = jitter(seed, 2) * Math.PI * 2;
		const phi = Math.acos(2 * jitter(seed, 3) - 1);
		const importance = nodeImportanceFor(members);
		const baseColor = topicColors[topic] || topicColors["其他"];
		const position = new THREE.Vector3(
			center.x + radius * Math.sin(phi) * Math.cos(theta),
			center.y + radius * Math.sin(phi) * Math.sin(theta),
			center.z + radius * Math.cos(phi),
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
		.map((edge) => {
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

const compactText = (value: string | null | undefined, maxLength: number) => {
	if (!value) return "";
	const normalized = value.replace(/\s+/g, " ").trim();
	if (normalized.length <= maxLength) return normalized;
	return `${normalized.slice(0, maxLength)}...`;
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
}) => {
	const mountRef = useRef<HTMLDivElement | null>(null);
	const frameRef = useRef<number | null>(null);
	const [selected, setSelected] = useState<Question | null>(questions[0] || null);
	const [hovered, setHovered] = useState<Question | null>(null);
	const [zoomLabel, setZoomLabel] = useState("1.0x");
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [isDetailOpen, setIsDetailOpen] = useState(false);
	const [resetSignal, setResetSignal] = useState(0);
	const [interactionMode, setInteractionMode] = useState<"rotate" | "pan">("rotate");
	const [granularity, setGranularity] = useState<GranularityMode>("constellation");

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
	const activeTopic = activeQuestion ? normalizeQuestionTopic(activeQuestion.topic) : "其他";
	const clusteredQuestionCount = nodes.reduce(
		(sum, node) => sum + Math.max(0, node.clusterSize - 1),
		0,
	);
	const relatedQuestions = useMemo(
		() => buildRelatedQuestions(activeQuestion, nodes, semanticEdges),
		[activeQuestion, nodes, semanticEdges],
	);

	useEffect(() => {
		setSelected((current) =>
			current && nodes.some((node) => node.question.id === current.id)
				? current
				: nodes[0]?.question || null,
		);
	}, [nodes]);

	useEffect(() => {
		if (!isFullscreen) return;
		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		setIsDetailOpen(false);
		window.dispatchEvent(new Event("resize"));
		return () => {
			document.body.style.overflow = originalOverflow;
			window.dispatchEvent(new Event("resize"));
		};
	}, [isFullscreen]);

	useEffect(() => {
		const mount = mountRef.current;
		if (!mount) return;

		const scene = new THREE.Scene();
		scene.fog = new THREE.FogExp2(0x030712, 0.00145);

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
		renderer.setSize(mount.clientWidth, mount.clientHeight);
		mount.replaceChildren(renderer.domElement);

		const camera = new THREE.PerspectiveCamera(
			56,
			mount.clientWidth / mount.clientHeight,
			0.1,
			1400,
		);
		const baseCameraZ = granularity === "constellation" ? 350 : granularity === "cluster" ? 390 : 430;
		camera.position.set(0, 0, baseCameraZ);

		const group = new THREE.Group();
		scene.add(group);

		scene.add(new THREE.AmbientLight(0xffffff, 0.92));
		const point = new THREE.PointLight(0x67e8f9, 1.35, 900);
		point.position.set(80, 130, 220);
		scene.add(point);

		const starGeometry = new THREE.BufferGeometry();
		const starPositions: number[] = [];
		const starColors: number[] = [];
		const starSizes: number[] = [];
		nodes.forEach((node, index) => {
			const twinkle = 1 + jitter(hashString(`${node.question.id}-${index}`), 12) * 0.62;
			starPositions.push(node.position.x, node.position.y, node.position.z);
			starColors.push(node.color.r, node.color.g, node.color.b);
			starSizes.push(node.size * (isFullscreen ? 23 : 18) * twinkle);
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
				attribute vec3 color;
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
					float halo = smoothstep(0.5, 0.02, dist) * 0.76;
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
				satelliteSizes.push((isFullscreen ? 13 : 10) * (0.7 + jitter(seed + index, 5) * 0.9));
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
			size: isFullscreen ? 5.2 : 4.2,
			sizeAttenuation: true,
			vertexColors: true,
			map: glowTexture || undefined,
			alphaTest: 0.02,
			transparent: true,
			opacity: 0.5,
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
			opacity: granularity === "constellation" ? 0.11 : granularity === "cluster" ? 0.15 : 0.13,
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
				color: 0xbdefff,
				size: 1.15,
				vertexColors: true,
				transparent: true,
				opacity: 0.5,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
			}),
		);
		scene.add(dust);

		const raycaster = new THREE.Raycaster();
		raycaster.params.Points = { threshold: isFullscreen ? 9 : 7 };
		const pointer = new THREE.Vector2();
		let targetRotationX = 0;
		let targetRotationY = 0;
		let targetPanX = 0;
		let targetPanY = 0;
		let isDragging = false;
		let dragMode: "rotate" | "pan" = "rotate";
		let dragMoved = 0;
		let lastX = 0;
		let lastY = 0;
		let lastResetSignal = resetSignal;

		const updatePointer = (event: PointerEvent) => {
			const rect = renderer.domElement.getBoundingClientRect();
			pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
			pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
		};

		const pickQuestion = () => {
			raycaster.setFromCamera(pointer, camera);
			const intersections = raycaster.intersectObject(starPoints);
			const pointIndex = intersections[0]?.index;
			return typeof pointIndex === "number" ? nodes[pointIndex]?.question || null : null;
		};

		const handlePointerDown = (event: PointerEvent) => {
			isDragging = true;
			dragMode = interactionMode === "pan" || event.shiftKey || event.altKey || event.button === 1 || event.button === 2
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
			const question = pickQuestion();
			setHovered(question);
			renderer.domElement.style.cursor = interactionMode === "pan"
				? "move"
				: question
					? "pointer"
					: "grab";
		};

		const handlePointerUp = (event: PointerEvent) => {
			updatePointer(event);
			renderer.domElement.releasePointerCapture(event.pointerId);
			isDragging = false;
			dragMode = "rotate";
			renderer.domElement.style.cursor = "grab";
			if (dragMoved < 8) {
				const question = pickQuestion();
				if (question) {
					setSelected(question);
					setIsDetailOpen(true);
				}
			}
		};

		const handleWheel = (event: WheelEvent) => {
			event.preventDefault();
			camera.position.z = Math.max(
				120,
				Math.min(620, camera.position.z + event.deltaY * 0.42),
			);
			setZoomLabel(`${(baseCameraZ / camera.position.z).toFixed(1)}x`);
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

		const animate = () => {
			if (lastResetSignal !== resetSignal) {
				lastResetSignal = resetSignal;
				targetRotationX = 0;
				targetRotationY = 0;
				targetPanX = 0;
				targetPanY = 0;
				camera.position.z = baseCameraZ;
				setZoomLabel("1.0x");
			}
			group.rotation.y += (targetRotationY - group.rotation.y) * 0.08;
			group.rotation.x += (targetRotationX - group.rotation.x) * 0.08;
			group.position.x += (targetPanX - group.position.x) * 0.12;
			group.position.y += (targetPanY - group.position.y) * 0.12;
			dust.rotation.y -= 0.00018;
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
			starGeometry.dispose();
			starMaterial.dispose();
			satelliteGeometry.dispose();
			satelliteMaterial.dispose();
			glowGeometry.dispose();
			glowMaterial.dispose();
			glowTexture?.dispose();
			edgeGeometry.dispose();
			edgeMaterial.dispose();
			dustGeometry.dispose();
			(dust.material as THREE.Material).dispose();
			renderer.dispose();
			mount.replaceChildren();
		};
	}, [nodes, edges, isFullscreen, resetSignal, interactionMode, granularity]);

	if (!questions.length) {
		return (
			<section className="rounded-2xl border border-white/10 bg-slate-950/55 p-6 text-center sm:rounded-[2rem] sm:p-10">
				<Sparkles className="mx-auto h-10 w-10 text-slate-500" />
				<p className="mt-3 text-slate-300">
					{loading ? "正在生成问题星图..." : "这个星区暂时没有问题。"}
				</p>
			</section>
		);
	}

	return (
		<section
			style={
				isFullscreen
					? {
						position: "fixed",
						inset: 0,
						width: "100vw",
						height: "100svh",
						margin: 0,
					}
					: undefined
			}
			className={`overflow-hidden border shadow-2xl shadow-cyan-950/30 transition-all duration-300 ${
				isFullscreen
					? "fixed inset-0 z-[100] rounded-none border-transparent bg-black"
					: "relative rounded-2xl border-cyan-300/15 bg-slate-950/70 sm:rounded-[2rem]"
			}`}
		>
			<div
				className={`absolute inset-0 ${
					isFullscreen
						? "bg-[radial-gradient(circle_at_50%_42%,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_72%_28%,rgba(236,72,153,0.16),transparent_28%),linear-gradient(180deg,#01030a_0%,#030712_52%,#070315_100%)]"
						: "bg-[radial-gradient(circle_at_48%_42%,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_78%_24%,rgba(236,72,153,0.14),transparent_32%)]"
				}`}
			/>
			<div
				className={`relative grid ${
					isFullscreen
						? "h-[100svh] min-h-[100svh]"
						: "grid-rows-[minmax(560px,68svh)_auto] lg:min-h-[760px] lg:grid-cols-[minmax(0,1fr)_390px] lg:grid-rows-1"
				}`}
			>
				<div className={`relative ${isFullscreen ? "min-h-[100svh]" : "min-h-[560px] lg:min-h-[760px]"}`}>
					<div ref={mountRef} className="absolute inset-0" />
					<div className="pointer-events-none absolute left-3 right-3 top-3 z-20 flex flex-wrap gap-2 sm:left-5 sm:right-5 sm:top-5">
						<span className="inline-flex min-w-0 items-center gap-2 rounded-full border border-cyan-300/20 bg-slate-950/75 px-2.5 py-1.5 text-[11px] text-cyan-100 backdrop-blur sm:px-3 sm:text-xs">
							<MousePointer2 className="h-3.5 w-3.5" />
							<span className="sm:hidden">
								{interactionMode === "pan" ? `平移 · ${zoomLabel}` : `旋转 · ${zoomLabel}`}
							</span>
							<span className="hidden sm:inline">
								{interactionMode === "pan"
									? `平移模式 · 拖拽移动 · 滚轮缩放 ${zoomLabel}`
									: `拖拽旋转 · Shift 拖拽平移 · 滚轮缩放 ${zoomLabel}`}
							</span>
						</span>
						<span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/20 bg-slate-950/75 px-2.5 py-1.5 text-[11px] text-fuchsia-100 backdrop-blur sm:px-3 sm:text-xs">
							<Network className="h-3.5 w-3.5" />
							<span className="sm:hidden">{nodes.length} 星 · {edges.length} 线</span>
							<span className="hidden sm:inline">{nodes.length} 颗可见星 · {edges.length} 条相似连线</span>
						</span>
						{clusteredQuestionCount > 0 && (
							<span className="hidden items-center gap-2 rounded-full border border-amber-300/20 bg-slate-950/75 px-3 py-1.5 text-xs text-amber-100 backdrop-blur sm:inline-flex">
								<Layers3 className="h-3.5 w-3.5" />
								已折叠 {clusteredQuestionCount} 个相似问题
							</span>
						)}
					</div>
					<div className="absolute left-3 right-3 top-[3.35rem] z-20 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-slate-950/75 p-1.5 shadow-xl shadow-slate-950/30 backdrop-blur sm:left-5 sm:right-auto sm:top-[4.65rem] sm:flex sm:flex-wrap sm:gap-2">
						{granularityOptions.map((option) => (
							<button
								key={option.mode}
								type="button"
								onClick={() => setGranularity(option.mode)}
								className={`min-w-0 rounded-xl px-2 py-2 text-center text-[11px] transition sm:px-3 sm:text-left sm:text-xs ${
									granularity === option.mode
										? "bg-cyan-300/18 text-cyan-50"
										: "text-slate-300 hover:bg-white/8 hover:text-white"
								}`}
							>
								<span className="block font-bold">{option.label}</span>
								<span className="hidden text-[10px] opacity-70 sm:block">{option.description}</span>
							</button>
						))}
					</div>
					<button
						type="button"
						onClick={() => setResetSignal((value) => value + 1)}
						className={`absolute right-3 inline-flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-slate-950/78 px-2.5 py-2 text-[11px] font-semibold text-cyan-50 shadow-xl shadow-slate-950/40 backdrop-blur transition hover:bg-cyan-300/10 sm:right-5 sm:gap-2 sm:px-3 sm:text-xs ${
							isFullscreen ? "top-[7.25rem] z-30 sm:top-16" : "top-[7.25rem] sm:top-16"
						}`}
					>
						<RotateCcw className="h-4 w-4" />
						居中
					</button>
					<button
						type="button"
						onClick={() =>
							setInteractionMode((mode) => (mode === "pan" ? "rotate" : "pan"))
						}
						className={`absolute right-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-2 text-[11px] font-semibold shadow-xl shadow-slate-950/40 backdrop-blur transition sm:right-5 sm:gap-2 sm:px-3 sm:text-xs ${
							interactionMode === "pan"
								? "border-amber-300/35 bg-amber-300/15 text-amber-50 hover:bg-amber-300/22"
								: "border-white/15 bg-slate-950/75 text-white hover:bg-white/10"
						} ${isFullscreen ? "top-[10rem] z-30 sm:top-[6.75rem]" : "top-[10rem] sm:top-[6.75rem]"}`}
					>
						<Move className="h-4 w-4" />
						{interactionMode === "pan" ? "旋转模式" : "平移模式"}
					</button>
					<button
						type="button"
						onClick={() => setIsFullscreen((value) => !value)}
						className={`absolute right-3 top-[12.75rem] inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-slate-950/78 px-2.5 py-2 text-[11px] font-semibold text-white shadow-xl shadow-slate-950/40 backdrop-blur transition hover:bg-white/10 sm:right-5 sm:top-5 sm:gap-2 sm:px-3 sm:text-xs ${
							isFullscreen ? "z-30" : ""
						}`}
					>
						{isFullscreen ? (
							<>
								<X className="h-4 w-4" />
								退出全屏
							</>
						) : (
							<>
								<Expand className="h-4 w-4" />
								全屏观星
							</>
						)}
					</button>
					{isFullscreen && !isDetailOpen && (
						<div className="pointer-events-none absolute left-3 right-3 top-[15.5rem] rounded-2xl border border-white/10 bg-slate-950/58 p-3 text-xs leading-5 text-slate-300 backdrop-blur sm:left-5 sm:right-auto sm:top-24 sm:max-w-xs">
							点击任意一颗星，查看问题、回答和相似问题。
						</div>
					)}
					<div
						className={`pointer-events-none absolute left-3 right-3 hidden gap-2 rounded-2xl border border-white/10 bg-slate-950/66 p-3 text-xs text-slate-300 backdrop-blur sm:grid md:left-auto md:max-w-lg ${
							isFullscreen ? "bottom-5 z-20" : "bottom-5"
						}`}
					>
						<div className="flex items-center gap-2">
							<Maximize2 className="h-3.5 w-3.5 text-cyan-200" />
							<span>点越大，代表“来源次数 + 同问热度 + 已回答/精选权重”越高。</span>
						</div>
						<div className="flex items-center gap-2">
							<Network className="h-3.5 w-3.5 text-fuchsia-200" />
							<span>连线来自核心词、标签、主题、需求意图和问法的混合相似度。</span>
						</div>
						<div className="flex items-center gap-2">
							<Layers3 className="h-3.5 w-3.5 text-cyan-200" />
							<span>星系视图会把高相似问题折叠成代表星；切到全部星星可查看原始问题。</span>
						</div>
						<div className="flex items-center gap-2">
							<Sparkles className="h-3.5 w-3.5 text-amber-200" />
							<span>星名会优先使用脱敏后的提交者昵称；历史导入问题按主题和标签自动命名。</span>
						</div>
					</div>
				</div>

				<aside
					className={`border-white/10 bg-slate-950/72 p-4 backdrop-blur-xl sm:p-5 ${
						isFullscreen
							? `${isDetailOpen ? "absolute" : "hidden"} inset-x-3 bottom-3 top-auto z-20 max-h-[58svh] overflow-auto rounded-2xl border bg-slate-950/82 shadow-2xl shadow-black/40 sm:bottom-5 sm:right-5 sm:left-auto sm:top-20 sm:max-h-none sm:w-[min(460px,calc(100vw-2.5rem))] sm:rounded-[1.5rem]`
							: "relative border-t lg:border-l lg:border-t-0"
					}`}
				>
					{activeQuestion && (!isFullscreen || isDetailOpen) && (
						<div className="flex min-h-full flex-col">
							{isFullscreen && (
								<div className="mb-4 flex justify-end">
									<button
										type="button"
										onClick={() => setIsDetailOpen(false)}
										className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/12"
										aria-label="关闭问题详情"
									>
										<X className="h-4 w-4" />
									</button>
								</div>
							)}
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<div className="flex flex-wrap items-center gap-2">
									<span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-50">
										{activeTopic}
									</span>
									<span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
										{starNameFor(activeQuestion)}
									</span>
								</div>
								<span className="text-xs text-slate-400">
									{activeNode?.totalSource || activeQuestion.source_count || 1} 次来源 · {activeNode?.totalSame || activeQuestion.same_question_count || 0} 人同问
								</span>
							</div>
							{activeNode && activeNode.clusterSize > 1 && (
								<div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/8 p-3 text-sm text-amber-50">
									<div className="flex items-center gap-2 font-semibold">
										<Layers3 className="h-4 w-4" />
										<span>
											这是一个问题星系，代表 {activeNode.clusterSize} 个相似问题
										</span>
									</div>
									<div className="mt-3 space-y-1.5 text-xs leading-5 text-amber-100/80">
										{activeNode.members
											.filter((member) => member.id !== activeQuestion.id)
											.slice(0, 4)
											.map((member) => (
												<p key={member.id}>· {compactText(member.content, 72)}</p>
											))}
									</div>
								</div>
							)}
							<h3 className="mt-5 text-xl font-black leading-snug text-white sm:text-2xl">
								{activeQuestion.content}
							</h3>
							{hovered && hovered.id !== activeQuestion.id && (
								<div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-300">
									正在指向 {starNameFor(hovered)}：{hovered.content.slice(0, 54)}
									{hovered.content.length > 54 ? "..." : ""}
								</div>
							)}
							<div className="mt-5 flex flex-wrap gap-2">
								{activeQuestion.tags?.slice(0, 5).map((tag) => (
									<span
										key={tag}
										className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300"
									>
										#{tag}
									</span>
								))}
							</div>
							<div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300 sm:p-4">
								{activeQuestion.answer ? (
									<div>
										<div className="flex items-center gap-2 text-emerald-200">
											<CheckCircle className="h-4 w-4" />
											<span>已点亮，已有正式回答</span>
										</div>
										<p className="mt-3 whitespace-pre-wrap leading-6 text-slate-200">
											{compactText(activeQuestion.answer, isFullscreen ? 360 : 220)}
										</p>
									</div>
								) : (
									<div className="flex items-center gap-2 text-amber-200">
										<Sparkles className="h-4 w-4" />
										<span>等待点亮，正在进入选题池</span>
									</div>
								)}
							</div>
							{relatedQuestions.length > 0 && (
								<div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
									<div className="flex items-center justify-between gap-3">
										<h4 className="flex items-center gap-2 text-sm font-bold text-white">
											<Network className="h-4 w-4 text-cyan-200" />
											附近与相似问题
										</h4>
										<span className="text-xs text-slate-500">
											{relatedQuestions.length} 个候选
										</span>
									</div>
									<div className="mt-3 space-y-2">
										{relatedQuestions.map(({ question, score, reasons }) => (
											<button
												key={question.id}
												type="button"
												onClick={() => {
													setSelected(question);
													setIsDetailOpen(true);
												}}
												className="w-full rounded-xl border border-white/10 bg-slate-950/45 p-3 text-left transition hover:border-cyan-300/30 hover:bg-slate-900/85"
											>
												<div className="flex items-start justify-between gap-3">
													<div>
														<p className="text-xs font-semibold text-cyan-100">
															{starNameFor(question)}
														</p>
														<p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-100">
															{question.content}
														</p>
													</div>
													<ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
												</div>
												<div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
													<span>{Math.round(score * 100)}% 相关</span>
													{question.answer && (
														<span className="inline-flex items-center gap-1 text-emerald-200">
															<MessageSquareText className="h-3 w-3" />
															有回答
														</span>
													)}
													{reasons.slice(0, 3).map((reason) => (
														<span key={reason}>· {reason}</span>
													))}
												</div>
											</button>
										))}
									</div>
								</div>
							)}
							<div className="mt-auto grid gap-3 pt-6 sm:flex sm:flex-col">
								<button
									type="button"
									onClick={() => onSameQuestion(activeQuestion)}
									className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/18"
								>
									我也想问
								</button>
								<Link
									to={`/qa/${activeQuestion.id}`}
									className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-50"
								>
									进入详情
									<ArrowUpRight className="h-4 w-4" />
								</Link>
							</div>
						</div>
					)}
				</aside>
			</div>
		</section>
	);
};

export default QuestionStarMap;
