import { useState } from 'react';
import type { NetworkPerson } from './types';

export default function Avatar({ person, size = 44 }: { person: NetworkPerson; size?: number }) {
  const [failed, setFailed] = useState(false);
  return <span className="network-avatar" style={{ width: size, height: size }}>
    {person.avatar && !failed ? <img src={person.avatar} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span>{Array.from(person.name).slice(0, 2).join('')}</span>}
  </span>;
}
