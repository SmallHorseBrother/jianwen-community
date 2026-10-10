import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Expand, Minus, Plus, RotateCcw } from 'lucide-react';
import Avatar from './Avatar';
import type { NetworkEdge, NetworkPerson, NetworkTopic } from './types';

interface Props {
  people: NetworkPerson[]; edges: NetworkEdge[]; topics: NetworkTopic[]; selectedId: string | null;
  onSelect: (id: string | null) => void; autoRotate: boolean;
}
interface GraphControl { reset: () => void; zoom: (factor: number) => void }

export default function NetworkGraph({ people, edges, topics, selectedId, onSelect, autoRotate }: Props) {
  const host = useRef<HTMLDivElement>(null), canvasHost = useRef<HTMLDivElement>(null);
  const labels = useRef(new Map<string, HTMLButtonElement>()), controlsRef = useRef<GraphControl | null>(null);
  const stateRef = useRef({ selectedId, autoRotate });
  const [unavailable, setUnavailable] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  stateRef.current = { selectedId, autoRotate };
  const neighbors = new Set(edges.filter(e => e.source === selectedId || e.target === selectedId).flatMap(e => [e.source,e.target]));

  useEffect(() => {
    const el = canvasHost.current, container = host.current;
    if (!el || !container) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
    catch { setUnavailable(true); return; }
    setUnavailable(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 1, 1, 3000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = .07; controls.minDistance = 140; controls.maxDistance = 1100; controls.autoRotateSpeed = .45;
    let width=container.clientWidth,height=container.clientHeight,dirty=true,portrait=width<600;
    const reset = () => { camera.position.set(0, 10, width < 600 ? 820 : 650); controls.target.set(0,0,0); controls.update();dirty=true; };
    reset(); controlsRef.current = { reset, zoom: factor => { const delta=camera.position.clone().sub(controls.target); delta.setLength(THREE.MathUtils.clamp(delta.length()*factor,140,1100));camera.position.copy(controls.target).add(delta);controls.update();dirty=true; } };
    const positions = new Map<string, THREE.Vector3>();
    const layout=()=>people.forEach((person,index)=>{
      const angle=index*2.399963,radius=people.length===1?0:Math.sqrt((index+.5)/people.length)*245;
      positions.set(person.id,new THREE.Vector3(Math.cos(angle)*radius*(portrait?.76:1.2),Math.sin(angle)*radius*(portrait?1.18:.9),Math.sin(index*1.7)*45));
    });
    layout();
    const lineObjects: Array<{ line: THREE.Line; edge: NetworkEdge }> = [];
    for (const edge of edges) {
      const a=positions.get(edge.source),b=positions.get(edge.target); if(!a||!b)continue;
      const geometry=new THREE.BufferGeometry().setFromPoints([a,b]);
      const color = edge.kind==='match' ? '#b8a1e6' : edge.kind==='shared' ? '#637780' : '#68ddc3';
      const material=edge.kind==='match'||edge.kind==='shared'
        ? new THREE.LineDashedMaterial({color,transparent:true,opacity:.18,dashSize:3,gapSize:3})
        : new THREE.LineBasicMaterial({color,transparent:true,opacity:.25});
      const line=new THREE.Line(geometry,material);line.computeLineDistances();scene.add(line);lineObjects.push({line,edge});
    }
    const resize=()=>{width=container.clientWidth;height=container.clientHeight;if(portrait!==(width<600)){portrait=width<600;layout();for(const {line,edge} of lineObjects)line.geometry.setFromPoints([positions.get(edge.source)!,positions.get(edge.target)!]);reset();}renderer.setSize(width,height);camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();dirty=true;};
    const observer=new ResizeObserver(resize);observer.observe(container);resize();
    const projected=new THREE.Vector3();let frame=0,active=true,lastSelected:string|null|undefined;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animate=()=>{
      if(!active)return;frame=requestAnimationFrame(animate);
      if(document.hidden)return;
      const selected=stateRef.current.selectedId;
      controls.autoRotate=stateRef.current.autoRotate&&!reduced;const changed=controls.update();
      if(!changed&&!dirty&&lastSelected===selected)return;dirty=false;lastSelected=selected;
      for(const {line,edge} of lineObjects){const linked=edge.source===selected||edge.target===selected;(line.material as THREE.LineBasicMaterial).opacity=selected?(linked ? .8 : .035):(edge.kind==='shared' ? .065 : .2);}
      renderer.render(scene,camera);
      for(const person of people){const label=labels.current.get(person.id),position=positions.get(person.id);if(!label||!position)continue;
        projected.copy(position).project(camera);const visible=projected.z<1&&projected.z>-1&&Math.abs(projected.x)<1.15&&Math.abs(projected.y)<1.15;
        label.style.visibility=visible?'visible':'hidden';label.style.left=`${(projected.x*.5+.5)*width}px`;label.style.top=`${(-projected.y*.5+.5)*height}px`;
        const depth=camera.position.distanceTo(position),scale=THREE.MathUtils.clamp(450/depth,.6,1.25);
        label.style.transform=`translate(-50%, -50%) scale(${scale})`;label.style.zIndex=String(Math.round(1500-depth));
      }
    };animate();
    return ()=>{active=false;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();for(const {line}of lineObjects){line.geometry.dispose();(line.material as THREE.Material).dispose();}renderer.dispose();renderer.domElement.remove();controlsRef.current=null;};
  }, [people, edges, topics]);

  return <div className={`network-graph ${unavailable ? 'network-graph-fallback' : ''}`} ref={host} aria-label="可旋转的人脉星图">
    <div className="network-webgl" ref={canvasHost} />
    {unavailable && <p className="network-fallback-note">当前设备未启用 3D，已切换为可点击的成员视图。</p>}
    <div className="network-node-layer">
      {people.map(person => <button key={person.id} ref={element => { if(element)labels.current.set(person.id,element);else labels.current.delete(person.id); }}
        className={`network-node ${selectedId===person.id?'is-selected':''} ${selectedId&&!neighbors.has(person.id)&&selectedId!==person.id?'is-dimmed':''}`}
        style={{'--node-color':topics.find(t=>t.id===person.topic)?.color} as React.CSSProperties}
        aria-label={`查看 ${person.name} 的名片`} aria-pressed={selectedId===person.id} onClick={()=>onSelect(person.id)}>
        <Avatar person={person} size={45}/><span className="network-node-name">{person.name}</span>
      </button>)}
    </div>
    {!people.length && <div className="network-empty">没有符合筛选条件的成员</div>}
    <div className="network-graph-foot"><span>{unavailable?'点击头像查看名片':'拖动旋转 · 双指 / 滚轮缩放 · 点击头像'}</span>
      {!unavailable && <div className="network-graph-controls">
        <button title="缩小" aria-label="缩小星图" onClick={()=>controlsRef.current?.zoom(1.2)}><Minus size={17}/></button>
        <button title="放大" aria-label="放大星图" onClick={()=>controlsRef.current?.zoom(.82)}><Plus size={17}/></button>
        <button title="返回全景" aria-label="返回全景" onClick={()=>{controlsRef.current?.reset();onSelect(null);}}><RotateCcw size={17}/></button>
        <button title="全屏" aria-label="全屏星图" onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else void host.current?.parentElement?.requestFullscreen().catch(()=>setFullscreenError('当前浏览器不支持全屏'));}}><Expand size={17}/></button>
      </div>}
    </div>
    {fullscreenError && <span role="status" className="network-fullscreen-note">{fullscreenError}</span>}
  </div>;
}
