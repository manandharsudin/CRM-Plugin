/* ===== Hi-fi kit: icons, badges, WP shells ===== */

/* --- line icons (UI iconography) --- */
const I = {
  dash:  <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>,
  post:  <path d="M5 3h11l3 3v15a0 0 0 0 1 0 0H5zM14 3v4h4M8 13h8M8 17h8M8 9h3"/>,
  page:  <path d="M6 2h8l4 4v16H6zM14 2v4h4"/>,
  media: <path d="M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6"/>,
  appearance: <path d="M12 3a9 9 0 100 18 3 3 0 003-3v-1a2 2 0 012-2h1a3 3 0 003-3 9 9 0 00-12-6z"/>,
  ticket:<path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4zM12 6v12"/>,
  plug:  <path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 01-10 0zM12 16v6"/>,
  gear:  <path d="M12 9a3 3 0 100 6 3 3 0 000-6zM19 12a7 7 0 00-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1l-.3-2.5H9.5l-.3 2.5a7 7 0 00-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 000 2l-2 1.6 2 3.4 2.4-1a7 7 0 001.7 1l.3 2.5h4.9l.3-2.5a7 7 0 001.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1z"/>,
  search:<><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></>,
  back:  <path d="M15 18l-6-6 6-6"/>,
  chev:  <path d="M9 6l6 6-6 6"/>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6"/>,
  lock:  <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></>,
  note:  <path d="M5 4h14v12l-4 4H5zM15 20v-4h4"/>,
  send:  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>,
  check: <path d="M20 6L9 17l-5-5"/>,
  mail:  <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  user:  <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></>,
  users: <><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 5a3.5 3.5 0 010 7M22 20a6 6 0 00-5-6"/></>,
  copy:  <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></>,
  filter:<path d="M3 5h18l-7 8v6l-4 2v-8z"/>,
  bell:  <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>,
  flag:  <path d="M5 21V4M5 4h11l-2 4 2 4H5"/>,
  ext:   <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5"/>,
  refresh:<path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5"/>,
  warn:  <path d="M12 3l9 16H3zM12 10v4M12 17v.5"/>,
  hourglass:<path d="M7 3h10M7 21h10M7 3c0 4 4 5 5 7 1-2 5-3 5-7M7 21c0-4 4-5 5-7 1 2 5 3 5 7"/>,
  chat:  <path d="M21 12a8 8 0 01-8 8H4l2-3a8 8 0 1115-5z"/>,
  inbox: <path d="M3 13l3-9h12l3 9v6H3zM3 13h5l1 3h6l1-3h5"/>,
  doc:   <path d="M6 2h8l4 4v16H6zM14 2v4h4M9 13h6M9 17h6"/>,
  pin:   <path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z"/>,
  x:     <path d="M6 6l12 12M18 6L6 18"/>,
};
function Icon({n, s=18, sw=1.7, fill, style}){
  const solidKeys=["dash","post","page","media","appearance","ticket","plug","gear"];
  const solid = fill===undefined ? solidKeys.includes(n) : fill;
  return <svg width={s} height={s} viewBox="0 0 24 24" style={style}
    fill={solid?"currentColor":"none"} stroke={solid?"none":"currentColor"}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{I[n]}</svg>;
}

/* --- badges --- */
const ST={
  open:["Open","b-grey"], awaiting_agent:["Awaiting agent","b-amber"],
  awaiting_customer:["Awaiting you","b-blue"], resolved:["Resolved","b-green"], closed:["Closed","b-grey"],
};
const ST_ADMIN={...ST, awaiting_customer:["Awaiting customer","b-blue"]};
const PR={low:["Low","b-grey"],normal:["Normal","b-grey"],high:["High","b-amber"],critical:["Critical","b-red"]};
const Dot=({c})=><span className="dt" style={{background:c}}/>;
function Status({s, admin}){const[l,c]=(admin?ST_ADMIN:ST)[s];const dot={open:"#8c8f94",awaiting_agent:"#dba617",awaiting_customer:"#2271b1",resolved:"#00a32a",closed:"#8c8f94"}[s];
  return <span className={"badge "+c}><Dot c={dot}/>{l}</span>;}
function Priority({p}){const[l,c]=PR[p];return <span className={"badge "+c}>{l}</span>;}
function Tier({t}){return t==="pro"
  ? <span className="badge b-pro">★ Pro</span>
  : <span className="badge b-grey">Free</span>;}
function Badge({cls="b-grey",children,pill}){return <span className={"badge "+cls+(pill?" b-pill":"")}>{children}</span>;}

/* --- WordPress admin shell --- */
function WP({sub, go, children}){
  const items=[
    ["dash","Dashboard"],["post","Posts"],["page","Pages"],["media","Media"],["appearance","Appearance"],
  ];
  const subs=[["inbox","Inbox"],["contacts","Contacts"],["settings","Settings"]];
  const subFor={inbox:"inbox",thread:"inbox",contacts:"contacts",contact:"contacts",settings:"settings"}[sub];
  return (
    <div className="content" style={{minHeight:780}}>
      <div className="adminbar">
        <div className="ab"><Icon n="appearance" s={17} fill/></div>
        <div className="ab">SublimeTheme <Icon n="chev" s={13}/></div>
        <div className="ab"><Icon n="refresh" s={15}/> </div>
        <div className="ab"><Icon n="bell" s={15}/> 2</div>
        <div className="ab sp">Howdy, Alex Rivera <span style={{width:22,height:22,borderRadius:"50%",background:"#3c434a",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,marginLeft:4}}>AR</span></div>
      </div>
      <div className="wp-row">
        <div className="menu">
          {items.map(([k,l])=><div key={k} className="mi"><Icon n={k} s={18} fill/> {l}</div>)}
          <div className="mi on"><Icon n="ticket" s={18} fill/> Support</div>
          <div className="submenu">
            {subs.map(([k,l])=><div key={k} className={"si "+(subFor===k?"on":"")}
              onClick={()=>go(k==="inbox"?"inbox":k)}>{l}</div>)}
          </div>
          <div className="mi"><Icon n="plug" s={18} fill/> Plugins</div>
          <div className="mi"><Icon n="gear" s={18} fill/> Settings</div>
        </div>
        <div className="content">
          <div className="cbody">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* --- Portal shell --- */
function Portal({nav="Support", go, wide, crumb, children}){
  const items=["Home","Features","Pricing","Docs","Support"];
  return (
    <div className="pt">
      <div className="pt-head">
        <div className="pt-brand"><span className="lm">S</span>SublimeTheme</div>
        <div className="pt-nav">{items.map(i=><a key={i} className={i===nav?"on":""}>{i}</a>)}</div>
        <div style={{marginLeft:"auto"}}><button className="pt-btn pt-btn-primary" style={{padding:"9px 16px"}}>Get the plugin</button></div>
      </div>
      <div className="pt-main">
        <div className={"pt-wrap"+(wide?" wide":"")}>
          {crumb && <div className="pt-crumb">{crumb}</div>}
          {children}
        </div>
      </div>
      <div className="pt-foot">
        <span>© 2026 SublimeTheme</span><a>Privacy</a><a>Terms</a><a>Docs</a>
        <span style={{marginLeft:"auto"}}>support@sublimetheme.com</span>
      </div>
    </div>
  );
}

Object.assign(window,{Icon, Status, Priority, Tier, Badge, Dot, WP, Portal});
