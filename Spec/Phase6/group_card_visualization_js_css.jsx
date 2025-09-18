import React from "react";
import { ChevronRight } from "lucide-react";
import { GrTrophy } from "react-icons/gr";
import { LuUsers } from "react-icons/lu";

// Inline CSS so you can drop this into any project without Tailwind
const styles = `
:root{
  --card-bg:#fff; --card-border:#E5E7EB; --text:#0f172a; --muted:#64748b;
}
.gc-wrap{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;padding:16px;background:#f5efe9}
.gc{position:relative;display:grid;grid-template-columns:68px 1fr;align-items:center;width:250px;max-width:100%;background:var(--card-bg);border:1px solid var(--card-border);border-radius:12px;box-shadow:0 6px 24px rgba(15,23,42,.06);overflow:hidden}
.gc:hover{box-shadow:0 10px 30px rgba(15,23,42,.10)}
.gc-thumb{width:68px;height:68px;background:#eef2ff}
.gc-thumb>img{display:block;width:100%;height:100%;object-fit:cover}
.gc-content{padding:10px 16px 16px 12px;min-width:0}
.gc-name{font-weight:700;font-size:16px;line-height:1.1;color:var(--text);margin:0 0 6px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gc-stats{display:flex;align-items:center;gap:12px;color:var(--muted);font-size:12px}
.gc-stat{display:inline-flex;align-items:center;gap:6px}
.gc-ico{width:14px;height:14px}
.gc-dot{opacity:.5}
.gc-chevron{position:absolute;right:8px;bottom:8px;border:0;background:transparent;padding:2px;cursor:pointer;opacity:.7}
.gc-chevron:hover{opacity:1}
.gc-chevron svg{width:18px;height:18px;color:#64748b}
`;

const Card = ({ name, objectives, members, img }) => (
  <div className="gc">
    <div className="gc-thumb"><img src={img} alt=""/></div>
    <div className="gc-content">
      <h4 className="gc-name" title={name}>{name}</h4>
      <div className="gc-stats">
        <span className="gc-stat"><GrTrophy className="gc-ico"/> {objectives}</span>
        <span className="gc-dot">•</span>
        <span className="gc-stat"><LuUsers className="gc-ico"/> {members}</span>
      </div>
    </div>
    <button className="gc-chevron" aria-label="Open group"><ChevronRight/></button>
  </div>
);

export default function GroupCardPreview(){
  const sample = [
    {name:"HR", objectives:4, members:5, img:"https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=300&auto=format&fit=crop"},
  ];
  return (
    <div style={{padding:12}}>
      <style>{styles}</style>
      <div className="gc-wrap">
        {sample.map((g, i)=> <Card key={i} {...g} />)}
      </div>
    </div>
  );
}
