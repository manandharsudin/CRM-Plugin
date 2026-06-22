/* ===== Hi-fi floating launcher ===== */
const {useState:useStateL} = React;

function Launcher(){
  const [open,setOpen]=useStateL(true);
  const [view,setView]=useStateL("new"); // new | list | thread
  const tabs=[["new","No session"],["list","My tickets"],["thread","Open thread"]];

  return (
    <div style={{position:"relative",height:700,background:"#fff",overflow:"hidden"}}>
      {/* faux vendor site */}
      <div style={{padding:"0",filter:"grayscale(.4) opacity(.55)",pointerEvents:"none"}}>
        <div className="pt-head" style={{borderBottom:"1px solid var(--line)"}}>
          <div className="pt-brand"><span className="lm">S</span>SublimeTheme</div>
          <div className="pt-nav" style={{marginLeft:8}}>{["Home","Features","Pricing","Docs","Support"].map(i=><a key={i} className={i==="Docs"?"on":""}>{i}</a>)}</div>
          <button className="pt-btn pt-btn-primary" style={{marginLeft:"auto",padding:"9px 16px"}}>Get the plugin</button>
        </div>
        <div style={{padding:"46px 50px",maxWidth:900,margin:"0 auto"}}>
          <div style={{fontSize:38,fontWeight:800,letterSpacing:"-.03em",lineHeight:1.1,marginBottom:14}}>Documentation</div>
          <div style={{height:14,background:"var(--line)",borderRadius:6,width:"60%",marginBottom:26}}/>
          {[88,94,72,90,66].map((w,i)=><div key={i} style={{height:11,background:"#e8e9ea",borderRadius:5,width:w+"%",marginBottom:14}}/>)}
          <div style={{height:180,background:"#eceef0",borderRadius:12,margin:"24px 0"}}/>
          {[92,80].map((w,i)=><div key={i} style={{height:11,background:"#e8e9ea",borderRadius:5,width:w+"%",marginBottom:14}}/>)}
        </div>
      </div>

      {/* proto control */}
      <div style={{position:"absolute",top:80,left:20,zIndex:5}}>
        <div className="switcher">
          {tabs.map(([k,l])=><button key={k} className={view===k&&open?"on":""} onClick={()=>{setView(k);setOpen(true);}}>{l}</button>)}
        </div>
      </div>

      {/* launcher */}
      <div style={{position:"absolute",right:28,bottom:28,zIndex:20}} className="col" >
        {open && (
          <div className="lq-panel" style={{marginBottom:16}}>
            <div className="lq-head row ac jb">
              <div><div style={{fontWeight:700,fontSize:16}}>Support</div>
                <div style={{fontSize:12.5,opacity:.9,marginTop:2}}>We usually reply within a few hours</div></div>
              <span style={{cursor:"pointer",opacity:.9}} onClick={()=>setOpen(false)}><Icon n="x" s={18}/></span>
            </div>

            {view==="new" && (
              <div className="scrollbox" style={{maxHeight:440,padding:18}}>
                <div className="pt-field"><label className="pt-label">Email</label><input className="pt-input" placeholder="you@yoursite.com"/></div>
                <div className="pt-field"><label className="pt-label">Subject</label><input className="pt-input" placeholder="Short summary"/></div>
                <div className="pt-field"><label className="pt-label">Message</label><textarea className="pt-textarea" style={{minHeight:90}} placeholder="How can we help?"></textarea></div>
                <button className="pt-btn pt-btn-primary pt-btn-lg"><Icon n="send" s={15}/> Send message</button>
                <div style={{borderTop:"1px solid var(--line)",margin:"16px 0",paddingTop:14}} className="row ac jb">
                  <span className="muted tiny">Already have a ticket?</span>
                  <a style={{fontWeight:700,fontSize:13}} onClick={()=>setView("list")}>Sign in →</a></div>
              </div>
            )}

            {view==="list" && (
              <div className="scrollbox" style={{maxHeight:440}}>
                <div className="row ac jb" style={{padding:"12px 16px",borderBottom:"1px solid var(--line)"}}>
                  <span className="kick">My tickets</span>
                  <button className="pt-btn pt-btn-primary" style={{padding:"6px 12px",fontSize:13}} onClick={()=>setView("new")}>+ New</button></div>
                {[[481,"Plugin crashes on activation","awaiting_agent",1],[410,"Custom widget area","resolved",0]].map((r,i)=>(
                  <div key={r[0]} onClick={()=>setView("thread")} className="row ac g10"
                    style={{padding:"14px 16px",borderBottom:"1px solid var(--line)",cursor:"pointer"}}>
                    <div className="grow">
                      <div className="row ac g8" style={{marginBottom:5}}><span className="kick">#{r[0]}</span>
                        {r[3]>0 && <span className="badge b-blue b-pill">{r[3]} new</span>}</div>
                      <div style={{fontSize:14,fontWeight:700,marginBottom:6}}>{r[1]}</div>
                      <Status s={r[2]}/></div>
                    <Icon n="chev" s={18} style={{color:"var(--g3)"}}/></div>))}
              </div>
            )}

            {view==="thread" && (
              <div className="col" style={{height:440}}>
                <div className="row ac g10" style={{padding:"12px 16px",borderBottom:"1px solid var(--line)"}}>
                  <span style={{cursor:"pointer"}} onClick={()=>setView("list")}><Icon n="back" s={16}/></span>
                  <div><div className="kick">#481</div><b style={{fontSize:13.5}}>Plugin crashes on activation</b></div></div>
                <div className="pt-thread scrollbox grow" style={{padding:16}}>
                  <div className="pt-msg" style={{maxWidth:"92%"}}><div className="av" style={{width:30,height:30,fontSize:11}}>JD</div>
                    <div><div className="who">You · 8m</div><div className="pt-bubble" style={{fontSize:13.5}}>The whole network goes white on activate.</div></div></div>
                  <div className="pt-msg me" style={{maxWidth:"92%"}}><div className="av" style={{width:30,height:30,fontSize:11}}>ST</div>
                    <div><div className="who" style={{textAlign:"right"}}>Support · 5m</div><div className="pt-bubble" style={{fontSize:13.5}}>Could you grab the fatal from debug.log?</div></div></div>
                </div>
                <div style={{padding:"12px 14px",borderTop:"1px solid var(--line)"}} className="row g8">
                  <input className="pt-input" style={{borderRadius:8}} placeholder="Reply…"/>
                  <button className="pt-btn pt-btn-primary" style={{padding:"0 14px"}}><Icon n="send" s={15}/></button></div>
              </div>
            )}
          </div>
        )}
        <div style={{alignSelf:"flex-end"}}>
          <div className="lq-bubble" onClick={()=>setOpen(o=>!o)}><Icon n={open?"x":"chat"} s={26}/></div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window,{Launcher});
