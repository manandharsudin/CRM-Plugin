/* ===== Hi-fi portal screens ===== */
const {useState:useStateP} = React;

const CATS=["Technical","Billing","Feature request","Pre-sale","Bug report"];

function NewTicketFields(){
  return (
    <>
      <div className="row g16">
        <div className="pt-field grow"><label className="pt-label">Your email</label>
          <input className="pt-input" placeholder="you@yoursite.com"/></div>
        <div className="pt-field grow"><label className="pt-label">Name <span className="opt">(optional)</span></label>
          <input className="pt-input" placeholder="Jane Doe"/></div>
      </div>
      <div className="row g16">
        <div className="pt-field grow"><label className="pt-label">Subject</label>
          <input className="pt-input" placeholder="Short summary of the issue"/></div>
        <div className="pt-field" style={{width:200,flex:"none"}}><label className="pt-label">Category</label>
          <select className="pt-select" defaultValue="Technical">{CATS.map(c=><option key={c}>{c}</option>)}</select></div>
      </div>
      <div className="pt-field"><label className="pt-label">How can we help?</label>
        <textarea className="pt-textarea" placeholder="Describe what's happening, what you expected, and any steps to reproduce…"></textarea></div>
      <div className="pt-field"><label className="pt-label">License key <span className="opt">(optional — only if your support email differs from your purchase email)</span></label>
        <input className="pt-input" placeholder="sk_••••••••••••"/></div>
      <details style={{marginBottom:18}}>
        <summary style={{fontSize:13.5,color:"var(--wp-blue)",fontWeight:600,cursor:"pointer"}}>+ Add environment details (optional)</summary>
        <div className="row g12 wrap" style={{marginTop:12}}>
          <div className="pt-field grow" style={{minWidth:180,marginBottom:0}}><label className="pt-label">Site URL</label><input className="pt-input" placeholder="https://yoursite.com"/></div>
          <div className="pt-field" style={{width:96,marginBottom:0}}><label className="pt-label">WP</label><input className="pt-input" placeholder="6.8"/></div>
          <div className="pt-field" style={{width:96,marginBottom:0}}><label className="pt-label">PHP</label><input className="pt-input" placeholder="8.2"/></div>
          <div className="pt-field" style={{width:110,marginBottom:0}}><label className="pt-label">Plugin</label><input className="pt-input" placeholder="2.4.1"/></div>
        </div>
      </details>
      <div aria-hidden style={{position:"absolute",left:-9999,top:0}}><input tabIndex={-1} autoComplete="off" name="company_url"/></div>
    </>
  );
}

function PortalNew({go}){
  return (
    <Portal nav="Support" go={go} wide crumb={<><a>Home</a><Icon n="chev" s={12}/><span>Support</span></>}>
      <h1 className="pt-h1">How can we help?</h1>
      <p className="pt-sub">Open a support ticket and we'll reply by email — no account needed. Already have a ticket?{" "}
        <a style={{fontWeight:700}} onClick={()=>go("portal-auth")}>View your tickets →</a></p>
      <div className="row g24" style={{alignItems:"flex-start"}}>
        <div className="pt-card grow" style={{padding:28}}>
          <NewTicketFields/>
          <div className="row ac g16" style={{marginTop:4}}>
            <button className="pt-btn pt-btn-primary" style={{padding:"12px 24px"}}><Icon n="send" s={16}/> Submit ticket</button>
            <span className="muted" style={{fontSize:13}}>We usually reply within a few hours.</span>
          </div>
        </div>
        <div style={{width:280,flex:"none"}} className="col g16">
          <div className="pt-card" style={{padding:20}}>
            <div className="row ac g8" style={{marginBottom:10}}><Icon n="doc" s={18} style={{color:"var(--wp-blue)"}}/><b style={{fontSize:14.5}}>Before you post</b></div>
            <p style={{fontSize:13.5,color:"var(--g1)",lineHeight:1.55,margin:"0 0 12px"}}>Many questions are answered in our documentation — setup, demo import, and common conflicts.</p>
            <button className="pt-btn" style={{width:"100%"}}>Search the docs <Icon n="ext" s={15}/></button>
          </div>
          <div className="pt-card" style={{padding:20,background:"#f0f6fc",borderColor:"#c5d9ed"}}>
            <div className="row ac g8" style={{marginBottom:8}}><span className="badge b-pro">★ Pro</span><b style={{fontSize:14}}>Faster replies</b></div>
            <p style={{fontSize:13.5,color:"var(--g1)",lineHeight:1.55,margin:0}}>Use your <b>purchase email</b> and you're verified automatically — your tickets are prioritized, no license key needed.</p>
          </div>
          <div style={{padding:"0 4px"}}>
            <div className="row g10" style={{fontSize:12.5,color:"var(--g2)",lineHeight:1.5}}>
              <Icon n="lock" s={15} style={{flex:"none",marginTop:1}}/>
              <span>Your details are used only to handle your request. We reply by email with a secure link to your conversation.</span></div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function MyTickets({go}){
  const rows=[
    [481,"Plugin crashes on activation","awaiting_agent","high","4 min ago",1],
    [410,"Custom widget area registration","resolved","normal","Apr 12",0],
    [388,"Renewal invoice request","closed","low","Mar 30",0],
  ];
  return (
    <Portal nav="Support" go={go} crumb={<><a>Home</a><Icon n="chev" s={12}/><a onClick={()=>go("portal-new")}>Support</a><Icon n="chev" s={12}/><span>My tickets</span></>}>
      <div className="row ac jb" style={{marginBottom:22}}>
        <div><h1 className="pt-h1" style={{marginBottom:4}}>My tickets</h1>
          <p className="muted" style={{margin:0,fontSize:13.5}}>Signed in as jane@studio.com · <a>Sign out</a></p></div>
        <button className="pt-btn pt-btn-primary" onClick={()=>go("portal-new")}>+ New ticket</button>
      </div>
      <div className="pt-card" style={{overflow:"hidden"}}>
        {rows.map((r,i)=>(
          <div key={r[0]} onClick={()=>go("portal-thread")} className="row ac g16"
            style={{padding:"18px 22px",borderBottom:i<rows.length-1?"1px solid var(--line)":"0",cursor:"pointer"}}>
            <div className="grow" style={{minWidth:0}}>
              <div className="row ac g10" style={{marginBottom:5}}>
                <span className="kick">#{r[0]}</span>
                {r[5]>0 && <span className="badge b-blue b-pill">{r[5]} new reply</span>}</div>
              <div style={{fontSize:15.5,fontWeight:700,marginBottom:7}}>{r[1]}</div>
              <div className="row ac g8"><Status s={r[2]}/><Priority p={r[3]}/><span className="muted tiny">Updated {r[4]}</span></div>
            </div>
            <Icon n="chev" s={20} style={{color:"var(--g3)"}}/>
          </div>))}
      </div>
    </Portal>
  );
}

function PortalThread({go}){
  const [locked,setLocked]=useStateP(true);
  return (
    <Portal nav="Support" go={go} crumb={<><a onClick={()=>go("portal-tickets")}>My tickets</a><Icon n="chev" s={12}/><span>#481</span></>}>
      <div className="switcher" style={{marginBottom:14,background:"#e8eaed",border:"1px solid var(--line)"}}>
        <button onClick={()=>setLocked(false)} style={{color:!locked?"#fff":"var(--g2)",background:!locked?"var(--wp-blue)":"transparent"}}>Composer: active</button>
        <button onClick={()=>setLocked(true)} style={{color:locked?"#fff":"var(--g2)",background:locked?"var(--wp-blue)":"transparent"}}>Locked (free · 3-msg limit)</button>
      </div>
      <div className="row ac jb" style={{marginBottom:6}}>
        <h1 className="pt-h1" style={{fontSize:24,marginBottom:0}}>Plugin crashes on activation</h1>
        <span className="kick">#481</span>
      </div>
      <div className="row ac g8" style={{marginBottom:18}}><Status s="awaiting_agent"/><Priority p="high"/><Badge cls="b-grey">bug</Badge></div>

      <div className="pt-card" style={{overflow:"hidden"}}>
        <div className="pt-thread scrollbox" style={{padding:22,maxHeight:340}}>
          <div className="pt-msg"><div className="av">JD</div><div><div className="who">You · 8 min ago</div>
            <div className="pt-bubble">After updating to 2.4.1 the whole network goes white on activate. Multisite, 12 subsites.</div></div></div>
          {locked ? <>
            <div className="pt-msg"><div className="av">JD</div><div><div className="who">You · 7 min ago</div>
              <div className="pt-bubble">Disabling via FTP brings it back though.</div></div></div>
            <div className="pt-msg"><div className="av">JD</div><div><div className="who">You · 6 min ago · message 3 of 3</div>
              <div className="pt-bubble">Sending the debug.log now in case it helps.</div></div></div>
          </> : <>
            <div className="pt-msg me"><div className="av">ST</div><div><div className="who" style={{textAlign:"right"}}>SublimeTheme · 5 min ago</div>
              <div className="pt-bubble">Thanks Jane — that points to the network-activation hook. Could you grab the fatal from your debug.log?</div></div></div>
          </>}
          <div className="sysmsg" style={{margin:"10px 0 0"}}><span>updates automatically — checking for replies</span></div>
        </div>
        {locked ? (
          <div style={{padding:22,borderTop:"1px solid var(--line)",background:"#fafbfc"}}>
            <div style={{border:"1.5px dashed var(--line)",borderRadius:12,padding:"22px 20px",textAlign:"center",background:"#fff"}}>
              <div style={{width:46,height:46,borderRadius:"50%",background:"#f0f6fc",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",color:"var(--wp-blue)"}}><Icon n="lock" s={22}/></div>
              <div style={{fontWeight:700,fontSize:15.5,marginBottom:6}}>Thanks — we've received your messages</div>
              <p className="muted" style={{fontSize:13.5,maxWidth:400,margin:"0 auto",lineHeight:1.55}}>
                You'll get an email the moment we reply. You'll be able to respond again right here once we've gotten back to you.</p>
            </div>
          </div>
        ) : (
          <div style={{padding:18,borderTop:"1px solid var(--line)",background:"#fff"}}>
            <textarea className="pt-textarea" style={{minHeight:80,marginBottom:10}} placeholder="Write a reply…"></textarea>
            <div className="row ac jb">
              <span className="muted tiny">2 of 3 replies left before an agent responds</span>
              <button className="pt-btn pt-btn-primary"><Icon n="send" s={15}/> Send reply</button>
            </div>
          </div>
        )}
      </div>
    </Portal>
  );
}

function PortalAuth({go}){
  const [sent,setSent]=useStateP(false);
  return (
    <Portal nav="Support" go={go} crumb={<><a onClick={()=>go("portal-new")}>Support</a><Icon n="chev" s={12}/><span>Sign in</span></>}>
      <div style={{maxWidth:440,margin:"8px auto"}}>
        <div className="pt-card" style={{padding:30}}>
          {!sent ? <>
            <h1 className="pt-h1" style={{fontSize:24,marginBottom:8}}>View your tickets</h1>
            <p className="pt-sub" style={{fontSize:14,marginBottom:22}}>No password needed. Enter your email and we'll send a secure sign-in link.</p>
            <div className="pt-field"><label className="pt-label">Email</label><input className="pt-input" placeholder="you@yoursite.com"/></div>
            <button className="pt-btn pt-btn-primary pt-btn-lg" onClick={()=>setSent(true)}><Icon n="mail" s={16}/> Email me a sign-in link</button>
          </> : <div style={{textAlign:"center",padding:"6px 0"}}>
            <div style={{width:56,height:56,borderRadius:"50%",background:"#f0f6fc",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",color:"var(--wp-blue)"}}><Icon n="mail" s={26}/></div>
            <h1 className="pt-h1" style={{fontSize:21,marginBottom:8}}>Check your inbox</h1>
            <p className="muted" style={{fontSize:14,lineHeight:1.6,margin:"0 auto",maxWidth:340}}>
              If that address has tickets, a sign-in link is on its way. The link works once and expires in 48 hours.</p>
            <button className="pt-btn" style={{marginTop:20}} onClick={()=>setSent(false)}>← Use a different email</button>
          </div>}
        </div>
        <p className="tiny muted" style={{textAlign:"center",marginTop:14,lineHeight:1.5}}>
          For your security we never confirm whether an email has an account.</p>
      </div>
    </Portal>
  );
}

function PortalExpired({go}){
  return (
    <Portal nav="Support" go={go} crumb={<><a onClick={()=>go("portal-new")}>Support</a><Icon n="chev" s={12}/><span>Sign in</span></>}>
      <div style={{maxWidth:440,margin:"8px auto"}}>
        <div className="pt-card" style={{padding:30,textAlign:"center"}}>
          <div style={{width:56,height:56,borderRadius:"50%",background:"var(--amber-bg)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",color:"var(--amber)"}}><Icon n="hourglass" s={26}/></div>
          <h1 className="pt-h1" style={{fontSize:22,marginBottom:8}}>This link has expired</h1>
          <p className="muted" style={{fontSize:14,lineHeight:1.6,margin:"0 auto 22px",maxWidth:360}}>
            Sign-in links can be used once and expire after 48 hours. Enter your email and we'll send a fresh one.</p>
          <div className="pt-field" style={{textAlign:"left"}}><label className="pt-label">Email</label><input className="pt-input" placeholder="you@yoursite.com"/></div>
          <button className="pt-btn pt-btn-primary pt-btn-lg"><Icon n="mail" s={16}/> Send a new link</button>
        </div>
      </div>
    </Portal>
  );
}

function PortalEmpty({go}){
  return (
    <Portal nav="Support" go={go} crumb={<><a onClick={()=>go("portal-new")}>Support</a><Icon n="chev" s={12}/><span>My tickets</span></>}>
      <h1 className="pt-h1" style={{marginBottom:22}}>My tickets</h1>
      <div className="pt-card" style={{padding:"60px 28px",textAlign:"center"}}>
        <div style={{width:72,height:72,borderRadius:"50%",background:"#f0f6fc",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px",color:"var(--wp-blue)"}}><Icon n="inbox" s={34}/></div>
        <div style={{fontWeight:700,fontSize:18,marginBottom:8}}>No tickets yet</div>
        <p className="muted" style={{fontSize:14,maxWidth:380,margin:"0 auto 22px",lineHeight:1.6}}>
          When you open a support request it'll appear here, so you can follow the whole conversation in one place.</p>
        <button className="pt-btn pt-btn-primary" onClick={()=>go("portal-new")}>Open your first ticket</button>
      </div>
    </Portal>
  );
}

function PortalCap({go}){
  return (
    <Portal nav="Support" go={go} crumb={<><a>Home</a><Icon n="chev" s={12}/><span>Support</span></>}>
      <h1 className="pt-h1">How can we help?</h1>
      <p className="pt-sub">Open a support ticket and we'll reply by email — no account needed.</p>
      <div className="pt-card" style={{overflow:"hidden",marginBottom:22,border:"1.5px solid var(--amber-line)"}}>
        <div style={{background:"var(--amber-bg)",padding:"18px 22px",borderBottom:"1px solid var(--amber-line)"}}>
          <div className="row g12">
            <Icon n="warn" s={22} style={{color:"var(--amber)",flex:"none",marginTop:1}}/>
            <div><div style={{fontWeight:700,fontSize:15,marginBottom:3}}>You already have an open ticket</div>
              <p style={{fontSize:13.5,color:"var(--g1)",margin:0,lineHeight:1.55}}>
                Free accounts keep one open ticket at a time so we can give each one proper attention. Please continue the conversation on your existing ticket.</p></div>
          </div>
        </div>
        <div style={{padding:"16px 22px"}} className="row ac g16">
          <div className="grow">
            <div className="row ac g8" style={{marginBottom:4}}><span className="kick">#472</span><Status s="awaiting_customer"/></div>
            <div style={{fontSize:15,fontWeight:700}}>How do I enable the mega-menu?</div></div>
          <button className="pt-btn pt-btn-primary" onClick={()=>go("portal-thread")}>Go to my ticket <Icon n="arrow" s={15}/></button>
        </div>
      </div>
      <p className="tiny muted" style={{lineHeight:1.5}}>Pro customers can keep up to 5 open tickets and see a softer message — continue an existing thread or wait until one is resolved.</p>
    </Portal>
  );
}

Object.assign(window,{PortalNew, MyTickets, PortalThread, PortalAuth, PortalExpired, PortalEmpty, PortalCap});
