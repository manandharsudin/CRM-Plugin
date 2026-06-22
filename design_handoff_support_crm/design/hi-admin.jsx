/* ===== Hi-fi admin screens ===== */
const {useState:useStateA} = React;

const TK=[
  {id:481,subj:"Plugin crashes on activation (multisite network)",who:"Jane Doe",email:"jane@studio.com",st:"awaiting_agent",pr:"high",tier:"pro",cat:"bug",t:"4 min ago",unread:2,
   prev:"After updating to 2.4.1 the whole network goes white on activate. Disabling via FTP fixes it. Multisite, 12 subsites."},
  {id:479,subj:"License not recognized after renewal",who:"M. Okafor",email:"m.okafor@brand.io",st:"awaiting_agent",pr:"normal",tier:"pro",cat:"billing",t:"22 min ago",unread:1,
   prev:"I renewed yesterday but the plugin still says my license expired. Order #FS-20518."},
  {id:472,subj:"How do I enable the mega-menu?",who:"sam@indie.co",email:"sam@indie.co",st:"awaiting_customer",pr:"low",tier:"free",cat:"presale",t:"1 hr ago",unread:0,
   prev:"Trying the free version — can't find the mega-menu toggle anywhere."},
  {id:468,subj:"Feature request: RTL language support",who:"L. Haddad",email:"leila@haddad.dev",st:"open",pr:"normal",tier:"pro",cat:"feature",t:"3 hr ago",unread:0,
   prev:"Would love proper RTL handling for the header layouts."},
  {id:455,subj:"Checkout block conflicts with theme styles",who:"R. Singh",email:"r.singh@shopco.in",st:"awaiting_customer",pr:"critical",tier:"pro",cat:"technical",t:"5 hr ago",unread:0,
   prev:"The WooCommerce checkout block loses all styling when your theme is active."},
  {id:441,subj:"Where are the demo import files?",who:"newbie@gmail.com",email:"newbie@gmail.com",st:"resolved",pr:"low",tier:"free",cat:"technical",t:"1 day ago",unread:0,
   prev:"Found them — thanks! (Appearance → Demo Import.)"},
];

function Select({label, val, w=150, opts}){
  return (
    <label className="col g6">
      {label && <span className="tiny muted" style={{fontWeight:600}}>{label}</span>}
      <select className="wp-select" style={{width:w,maxWidth:"none",padding:"6px 8px"}} defaultValue={val}>
        {(opts||[val]).map(o=><option key={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Toolbar(){
  return (
    <div className="panel" style={{padding:"12px 14px",marginBottom:14}}>
      <div className="row ac g12 wrap">
        <Select val="Status: All" opts={["Status: All","Open","Awaiting agent","Awaiting customer","Resolved"]}/>
        <Select val="Priority: All" opts={["Priority: All","Critical","High","Normal","Low"]}/>
        <Select val="Tier: All" opts={["Tier: All","Pro / verified","Free"]}/>
        <Select val="Assignee: All" w={160} opts={["Assignee: All","Me (Alex)","Unassigned"]}/>
        <div className="grow" style={{position:"relative",minWidth:200}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--g3)"}}><Icon n="search" s={15}/></span>
          <input className="wp-input" style={{maxWidth:"none",paddingLeft:32}} placeholder="Search subject or email…"/>
        </div>
      </div>
    </div>
  );
}

function ListItem({tk,active,onClick}){
  return (
    <div onClick={onClick} style={{padding:"13px 15px",borderBottom:"1px solid var(--line3)",cursor:"pointer",
      background:active?"#f0f6fc":"#fff",borderLeft:active?"3px solid var(--wp-blue)":"3px solid transparent"}}>
      <div className="row ac g8" style={{marginBottom:7}}>
        <Tier t={tk.tier}/>
        {tk.pr==="critical"&&<Priority p="critical"/>}
        <span className="kick" style={{marginLeft:"auto"}}>#{tk.id} · {tk.t}</span>
      </div>
      <div style={{fontSize:13.5,fontWeight:600,color:"var(--wp-ink)",marginBottom:5,lineHeight:1.4}}>{tk.subj}</div>
      <div className="muted" style={{fontSize:12.5,marginBottom:8,lineHeight:1.5,display:"-webkit-box",WebkitLineClamp:1,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{tk.who} — {tk.prev}</div>
      <div className="row ac g6 wrap">
        <Status s={tk.st} admin/>{tk.pr!=="critical"&&tk.pr!=="low"&&<Priority p={tk.pr}/>}
        {tk.unread>0 && <span className="badge b-blue b-pill" style={{marginLeft:"auto"}}>{tk.unread} new</span>}
      </div>
    </div>
  );
}

function Inbox({go}){
  const [sel,setSel]=useStateA(481);
  const cur=TK.find(t=>t.id===sel);
  return (
    <div>
      <div className="pagehead"><h1 className="wrap-title">Support Inbox</h1>
        <span className="badge b-grey b-pill" style={{marginTop:4}}>6 open</span></div>
      <p className="subhead">Tickets float by verified status and priority. Select a conversation to preview it; open the full thread to reply, add internal notes, and see the customer's Freemius record.</p>
      <Toolbar/>
      <div className="panel" style={{display:"flex",height:600,overflow:"hidden",padding:0}}>
        {/* list */}
        <div style={{width:384,flex:"none",borderRight:"1px solid var(--line)",display:"flex",flexDirection:"column"}}>
          <div className="row ac jb" style={{padding:"9px 14px",borderBottom:"1px solid var(--line)",background:"#fbfbfc"}}>
            <span className="kick">6 tickets</span>
            <span className="row ac g4 tiny muted" style={{cursor:"pointer"}}>Sort: Smart <Icon n="chev" s={13} style={{transform:"rotate(90deg)"}}/></span>
          </div>
          <div className="scrollbox grow">{TK.map(t=><ListItem key={t.id} tk={t} active={sel===t.id} onClick={()=>setSel(t.id)}/>)}</div>
        </div>
        {/* reading pane */}
        <div className="grow col" style={{minWidth:0}}>
          <div style={{padding:"14px 18px",borderBottom:"1px solid var(--line)"}}>
            <div className="row ac g10" style={{marginBottom:9}}>
              <div style={{fontSize:15.5,fontWeight:600,lineHeight:1.35}}>{cur.subj}</div>
              <span className="kick" style={{marginLeft:"auto",whiteSpace:"nowrap"}}>#{cur.id}</span>
            </div>
            <div className="row ac g6 wrap">
              <Tier t={cur.tier}/><Status s={cur.st} admin/><Priority p={cur.pr}/>
              <Badge cls="b-grey">{cur.cat}</Badge>
              <button className="button button-primary button-sm" style={{marginLeft:"auto"}} onClick={()=>go("thread")}>
                Open full thread <Icon n="arrow" s={14}/></button>
            </div>
          </div>
          <div className="thread grow scrollbox">
            <div className="msg"><div className="av cust">{cur.who.slice(0,2).toUpperCase()}</div>
              <div className="body"><div className="who"><b>{cur.who}</b><span>customer · {cur.t}</span></div>
                <div className="bubble">{cur.prev}</div></div></div>
            <div className="sysmsg"><span>ticket opened · status set to awaiting_agent</span></div>
            <div className="msg"><div className="av cust">{cur.who.slice(0,2).toUpperCase()}</div>
              <div className="body"><div className="who"><b>{cur.who}</b><span>just now</span></div>
                <div className="bubble">Any update on this? It's blocking our launch — happy to send WP-admin access if that helps.</div></div></div>
          </div>
          <div style={{padding:"12px 18px",borderTop:"1px solid var(--line)",background:"#fff"}} className="row ac g10">
            <Icon n="lock" s={15} style={{color:"var(--g3)"}}/>
            <span className="muted" style={{fontSize:12.5}}>Replying, internal notes, and the customer record live in the full thread view.</span>
            <button className="button button-sm" style={{marginLeft:"auto"}} onClick={()=>go("thread")}>Reply →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Thread ---- */
function Thread({go}){
  const [mode,setMode]=useStateA("reply"); // reply | note
  return (
    <div>
      <div className="row ac g10" style={{marginBottom:10}}>
        <button className="button button-sm" onClick={()=>go("inbox")}><Icon n="back" s={14}/> Inbox</button>
        <span className="kick">Ticket #481</span>
      </div>
      <h1 className="wrap-title" style={{marginBottom:14}}>Plugin crashes on activation (multisite network)</h1>
      <div className="row g16" style={{alignItems:"flex-start"}}>
        {/* thread */}
        <div className="panel grow col" style={{height:630,overflow:"hidden",padding:0,minWidth:0}}>
          <div className="row ac g8 wrap" style={{padding:"12px 16px",borderBottom:"1px solid var(--line)"}}>
            <Tier t="pro"/><Status s="awaiting_agent" admin/><Priority p="high"/><Badge cls="b-grey">bug</Badge>
            <span className="muted tiny" style={{marginLeft:"auto"}}>Assigned to <b style={{color:"var(--wp-ink)"}}>you</b></span>
          </div>
          <div className="thread grow scrollbox">
            <div className="msg"><div className="av cust">JD</div><div className="body">
              <div className="who"><b>Jane Doe</b><span>customer · 8 min ago</span></div>
              <div className="bubble">After updating to 2.4.1 the whole network goes white on activate. Disabling via FTP fixes it. Multisite, 12 subsites. PHP 8.2, WP 6.8.</div></div></div>
            <div className="msg me"><div className="av agent">AR</div><div className="body">
              <div className="who" style={{justifyContent:"flex-end"}}><span>2 min ago · public reply</span><b>Alex Rivera</b></div>
              <div className="bubble">Thanks Jane — that points to the network-activation hook. Could you grab the fatal from <code>wp-content/debug.log</code> right after it goes white?</div></div></div>
            <div className="msg note"><div className="av" style={{background:"#dba617"}}><Icon n="note" s={16}/></div><div className="body">
              <div className="who"><b>Internal note</b><span>· Alex Rivera · only visible to agents</span></div>
              <div className="bubble">Looks like the dup of #470. If it's the same `switch_to_blog` loop, the 2.4.2 hotfix branch already has the guard. Don't promise a date yet.</div></div></div>
            <div className="msg"><div className="av cust">JD</div><div className="body">
              <div className="who"><b>Jane Doe</b><span>customer · just now</span></div>
              <div className="bubble">Got it, pulling the log now.</div></div></div>
          </div>
          {/* composer */}
          <div style={{borderTop:"1px solid var(--line)",background:mode==="note"?"var(--amber-note)":"#fff",transition:".15s"}}>
            <div className="row ac g4" style={{padding:"10px 14px 0"}}>
              <button onClick={()=>setMode("reply")} className="button button-sm"
                style={{borderRadius:"4px 4px 0 0",borderBottom:0,background:mode==="reply"?"#fff":"#f0f0f1",
                  borderColor:mode==="reply"?"var(--line)":"transparent",color:mode==="reply"?"var(--wp-blue-d)":"var(--g2)",fontWeight:mode==="reply"?600:400}}>
                Reply to customer</button>
              <button onClick={()=>setMode("note")} className="button button-sm"
                style={{borderRadius:"4px 4px 0 0",borderBottom:0,background:mode==="note"?"var(--amber-note)":"#f0f0f1",
                  borderColor:mode==="note"?"var(--amber-line)":"transparent",color:mode==="note"?"#996800":"var(--g2)",fontWeight:mode==="note"?600:400}}>
                <Icon n="lock" s={13}/> Internal note</button>
              <span className="muted tiny" style={{marginLeft:"auto",paddingRight:4}}>
                {mode==="note"?"Not emailed · agents only":"Customer gets a link-only email"}</span>
            </div>
            <div style={{padding:14}}>
              <textarea className="wp-textarea" style={{maxWidth:"none",minHeight:72,background:"#fff",
                border:mode==="note"?"1px solid var(--amber-line)":"1px solid #8c8f94"}}
                placeholder={mode==="note"?"Write a private note for the team…":"Write a reply… sets status to awaiting_customer"}></textarea>
              <div className="row ac g10" style={{marginTop:10}}>
                <button className="button button-sm"><Icon n="doc" s={14}/> Canned reply</button>
                <span className="muted tiny">{mode==="note"?"":"Notification queued via Action Scheduler — no content, link only."}</span>
                <button className="button button-primary" style={{marginLeft:"auto"}}>
                  {mode==="note"?<><Icon n="note" s={14}/> Save note</>:<><Icon n="send" s={14}/> Send reply</>}</button>
              </div>
            </div>
          </div>
        </div>

        {/* sidebar */}
        <div style={{width:300,flex:"none"}} className="col g14">
          <div className="panel">
            <div className="panel-h"><Icon n="user" s={16} style={{color:"var(--g2)"}}/> Customer</div>
            <div style={{padding:14}}>
              <div className="row ac g10" style={{marginBottom:11}}>
                <div className="av" style={{width:42,height:42,borderRadius:"50%",background:"#5a6b7d",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:14}}>JD</div>
                <div className="col"><b style={{fontSize:13.5}}>Jane Doe</b><span className="muted mono">jane@studio.com</span></div>
              </div>
              <div className="row g6 wrap" style={{marginBottom:12}}><Tier t="pro"/><Badge cls="b-green"><Dot c="#00a32a"/>License active</Badge></div>
              {[["Plan","Agency · Lifetime"],["License","sk_live_••••a31f"],["Expires","— (lifetime)"],["Active sites","4 installs"],["Freemius ID","#90215"],["Customer since","Mar 2024"]].map(([k,v])=>
                <div key={k} className="row jb" style={{padding:"6px 0",fontSize:12.5,borderBottom:"1px solid var(--line3)"}}>
                  <span className="muted">{k}</span><span style={{fontWeight:500,textAlign:"right"}}>{v}</span></div>)}
              <div className="tiny muted" style={{marginTop:10,display:"flex",gap:6,alignItems:"center"}}>
                <Icon n="refresh" s={12}/> Synced from Freemius · read-only</div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-h"><Icon n="gear" s={16} fill style={{color:"var(--g2)"}}/> Environment</div>
            <div style={{padding:14}}>
              {[["Site","studio.com"],["Install","Multisite · 12 subsites"],["WordPress","6.8"],["PHP","8.2"],["Plugin","2.4.1"]].map(([k,v])=>
                <div key={k} className="row jb" style={{padding:"5px 0",fontSize:12.5}}><span className="muted">{k}</span><span className="mono">{v}</span></div>)}
              <div className="tiny muted" style={{marginTop:8}}>Provided on the submission form.</div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-h">Manage</div>
            <div style={{padding:14}} className="col g10">
              <label className="col g6"><span className="tiny muted" style={{fontWeight:600}}>Status</span>
                <select className="wp-select" style={{maxWidth:"none"}} defaultValue="Awaiting agent"><option>Open</option><option>Awaiting agent</option><option>Awaiting customer</option><option>Resolved</option><option>Closed</option></select></label>
              <label className="col g6"><span className="tiny muted" style={{fontWeight:600}}>Priority</span>
                <select className="wp-select" style={{maxWidth:"none"}} defaultValue="High"><option>Low</option><option>Normal</option><option>High</option><option>Critical</option></select></label>
              <label className="col g6"><span className="tiny muted" style={{fontWeight:600}}>Assignee</span>
                <select className="wp-select" style={{maxWidth:"none"}} defaultValue="Alex Rivera (you)"><option>Unassigned</option><option>Alex Rivera (you)</option><option>Sam Patel</option></select></label>
              <div className="row g8" style={{marginTop:2}}>
                <button className="button button-primary button-sm grow jc"><Icon n="check" s={14}/> Resolve</button>
                <button className="button button-sm grow jc">Close</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Contacts ---- */
const CT=[
  ["JD","Jane Doe","jane@studio.com","pro","Agency · Lifetime","active","#00a32a",2,"4 min ago"],
  ["MO","M. Okafor","m.okafor@brand.io","pro","Pro · Annual","active","#00a32a",1,"22 min ago"],
  ["LH","L. Haddad","leila@haddad.dev","pro","Pro · Annual","active","#00a32a",1,"3 hr ago"],
  ["RS","R. Singh","r.singh@shopco.in","pro","Agency · Annual","expired","#dba617",1,"5 hr ago"],
  ["SA","sam@indie.co","sam@indie.co","free","—","none","#8c8f94",1,"1 hr ago"],
  ["NB","newbie","newbie@gmail.com","free","—","none","#8c8f94",0,"1 day ago"],
];
function Contacts({go}){
  return (
    <div>
      <div className="pagehead"><h1 className="wrap-title">Contacts</h1>
        <button className="button button-sm"><Icon n="refresh" s={14}/> Run Freemius backfill</button></div>
      <p className="subhead">Everyone synced from Freemius plus anyone who has submitted a ticket. Open a contact to see their plan, license state, and full conversation history.</p>
      <Toolbar/>
      <div className="panel" style={{overflow:"hidden",padding:0}}>
        <table className="wp-table">
          <thead><tr><th style={{width:44}}></th><th>Name</th><th>Email</th><th>Tier</th><th>Plan</th><th>License</th><th>Open</th><th>Last activity</th><th></th></tr></thead>
          <tbody>{CT.map((c,i)=>(
            <tr key={i} className="click" onClick={()=>go("contact")}>
              <td><div className="av" style={{width:30,height:30,borderRadius:"50%",background:"#5a6b7d",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:11,fontWeight:600}}>{c[0]}</div></td>
              <td className="col-strong">{c[1]}</td>
              <td className="mono muted">{c[2]}</td>
              <td><Tier t={c[3]}/></td>
              <td>{c[4]}</td>
              <td><span className="badge b-grey" style={{textTransform:"capitalize"}}><Dot c={c[6]}/>{c[5]}</span></td>
              <td>{c[7]>0?<span className="badge b-blue b-pill">{c[7]}</span>:<span className="muted">0</span>}</td>
              <td className="muted">{c[8]}</td>
              <td style={{color:"var(--g3)"}}><Icon n="chev" s={16}/></td>
            </tr>))}</tbody>
        </table>
      </div>
      <p className="tiny muted" style={{marginTop:10}}>Showing 6 of 6 · synced 2 minutes ago via webhook</p>
    </div>
  );
}

function Contact({go}){
  return (
    <div>
      <div className="row ac g10" style={{marginBottom:12}}>
        <button className="button button-sm" onClick={()=>go("contacts")}><Icon n="back" s={14}/> Contacts</button>
      </div>
      <div className="row g16" style={{alignItems:"flex-start"}}>
        <div className="panel" style={{width:300,flex:"none"}}>
          <div style={{padding:16}}>
            <div className="row ac g12" style={{marginBottom:14}}>
              <div className="av" style={{width:48,height:48,borderRadius:"50%",background:"#5a6b7d",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:16}}>JD</div>
              <div className="col"><b style={{fontSize:16}}>Jane Doe</b><span className="muted mono">jane@studio.com</span></div>
            </div>
            <div className="row g6 wrap" style={{marginBottom:14}}><Tier t="pro"/><Badge cls="b-green"><Dot c="#00a32a"/>License active</Badge></div>
            {[["Plan","Agency · Lifetime"],["Freemius ID","#90215"],["Active sites","4"],["Lifetime value","$249"],["Customer since","Mar 2024"]].map(([k,v])=>
              <div key={k} className="row jb" style={{padding:"7px 0",fontSize:12.5,borderBottom:"1px solid var(--line3)"}}>
                <span className="muted">{k}</span><span style={{fontWeight:500}}>{v}</span></div>)}
            <button className="button button-sm" style={{width:"100%",justifyContent:"center",marginTop:14}}><Icon n="ext" s={14}/> View in Freemius</button>
          </div>
        </div>
        <div className="panel grow" style={{padding:0,overflow:"hidden"}}>
          <div className="panel-h"><Icon n="ticket" s={16} fill style={{color:"var(--g2)"}}/> Ticket history <span className="muted" style={{fontWeight:400}}>· 3 total</span></div>
          <table className="wp-table">
            <thead><tr><th style={{width:60}}>#</th><th>Subject</th><th>Status</th><th>Priority</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              <tr className="click" onClick={()=>go("thread")}><td className="muted">481</td><td className="col-strong">Plugin crashes on activation</td><td><Status s="awaiting_agent" admin/></td><td><Priority p="high"/></td><td className="muted">4 min ago</td><td style={{color:"var(--g3)"}}><Icon n="chev" s={16}/></td></tr>
              <tr className="click"><td className="muted">410</td><td className="col-strong">Custom widget area registration</td><td><Status s="closed" admin/></td><td><Priority p="normal"/></td><td className="muted">Apr 2026</td><td style={{color:"var(--g3)"}}><Icon n="chev" s={16}/></td></tr>
              <tr className="click"><td className="muted">388</td><td className="col-strong">Renewal invoice request</td><td><Status s="resolved" admin/></td><td><Priority p="low"/></td><td className="muted">Mar 2026</td><td style={{color:"var(--g3)"}}><Icon n="chev" s={16}/></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---- Settings ---- */
function Settings(){
  const [tab,setTab]=useStateA("freemius");
  const tabs=[["freemius","Freemius"],["email","Email"],["tickets","Tickets & guards"]];
  return (
    <div>
      <h1 className="wrap-title" style={{marginBottom:4}}>Support CRM Settings</h1>
      <p className="subhead">Connect Freemius, configure transactional email, and tune the per-tier guard matrix.</p>
      <div className="nav-tab-wrapper">{tabs.map(([k,l])=>
        <div key={k} className={"nav-tab"+(tab===k?" active":"")} onClick={()=>setTab(k)}>{l}</div>)}</div>

      {tab==="freemius" && <div className="panel" style={{padding:"4px 22px 20px",maxWidth:760}}>
        <table className="form-table"><tbody>
          <tr><th>Product ID</th><td><input className="regular-text" defaultValue="14021"/><p className="field-desc">Your Freemius product ID.</p></td></tr>
          <tr><th>API bearer token</th><td><input className="regular-text" type="password" defaultValue="sk_live_abcdef123456"/><p className="field-desc">Used for license verification and the backfill job.</p></td></tr>
          <tr><th>Product secret key</th><td><input className="regular-text" type="password" defaultValue="••••••••••••••••"/><p className="field-desc">Encrypted at rest (wp_salt-derived). Verifies webhook HMAC signatures.</p></td></tr>
          <tr><th>Webhook URL</th><td>
            <div className="row ac g8" style={{maxWidth:400}}>
              <input className="regular-text" readOnly value="…/wp-json/yourcrm/v1/fs-webhook" style={{background:"#f6f7f7"}}/>
              <button className="button button-sm"><Icon n="copy" s={14}/></button></div>
            <p className="field-desc">Paste into your Freemius dashboard → Webhooks. Responds 200 instantly; processing is queued.</p></td></tr>
        </tbody></table>
        <div className="notice notice-success" style={{margin:"4px 0 16px",maxWidth:560}}>
          <div className="row ac g8"><Icon n="check" s={16} style={{color:"var(--green)"}}/><span><b>Connected.</b> Last webhook received 2 minutes ago · 1,284 contacts synced.</span></div></div>
        <div className="row ac g12">
          <button className="button"><Icon n="refresh" s={15}/> Run one-time backfill</button>
          <span className="tiny muted">Paginates all users + licenses. Resumable and idempotent.</span></div>
      </div>}

      {tab==="email" && <div className="panel" style={{padding:"4px 22px 20px",maxWidth:760}}>
        <table className="form-table"><tbody>
          <tr><th>From name</th><td><input className="regular-text" defaultValue="SublimeTheme Support"/></td></tr>
          <tr><th>From address</th><td><input className="regular-text" defaultValue="support@sublimetheme.com"/></td></tr>
          <tr><th>Agent fallback address</th><td><input className="regular-text" defaultValue="team@sublimetheme.com"/><p className="field-desc">Receives alerts when a ticket is unassigned.</p></td></tr>
          <tr><th>Notification debounce</th><td><div className="row ac g8"><input className="wp-input" style={{width:80}} defaultValue="10"/><span className="muted">minutes</span></div><p className="field-desc">Collapses rapid replies into a single email per customer.</p></td></tr>
          <tr><th>Auto-close after</th><td><div className="row ac g8"><input className="wp-input" style={{width:80}} defaultValue="7"/><span className="muted">days resolved</span></div></td></tr>
        </tbody></table>
        <div className="notice notice-warning" style={{maxWidth:560,marginBottom:8}}>
          <div className="row g8"><Icon n="warn" s={16} style={{color:"var(--amber)",flex:"none",marginTop:1}}/>
          <span>Transport uses <code>wp_mail</code> via your SMTP plugin (authenticated provider). <b>Customer emails never contain message content</b> — magic-link buttons only.</span></div></div>
      </div>}

      {tab==="tickets" && <div className="panel" style={{padding:"4px 22px 20px",maxWidth:760}}>
        <table className="form-table"><tbody>
          <tr><th>Categories</th><td><input className="regular-text" defaultValue="technical, billing, feature, presale, bug"/><p className="field-desc">Comma-separated. Shown in the portal submission form.</p></td></tr>
          <tr><th>Default priority</th><td><div className="row g16">
            <label className="col g6"><span className="tiny muted">Free / unverified</span><select className="wp-select" style={{width:140}} defaultValue="Low"><option>Low</option><option>Normal</option></select></label>
            <label className="col g6"><span className="tiny muted">Pro / verified</span><select className="wp-select" style={{width:140}} defaultValue="Normal"><option>Normal</option><option>High</option></select></label></div></td></tr>
        </tbody></table>
        <h3 style={{fontSize:13.5,margin:"6px 0 4px"}}>Guard matrix</h3>
        <p className="field-desc" style={{margin:"0 0 12px"}}>Per-tier limits enforced server-side at submission and reply.</p>
        <table className="wp-table" style={{border:"1px solid var(--line)",borderRadius:4,marginBottom:8}}>
          <thead><tr><th>Guard</th><th>Free / unverified</th><th>Pro / verified</th></tr></thead>
          <tbody>
            <tr><td style={{fontWeight:600,color:"var(--wp-ink)"}}>Max open tickets</td>
              <td><input className="wp-input" style={{width:64}} defaultValue="1"/> <span className="tiny muted">→ returns existing (409)</span></td>
              <td><input className="wp-input" style={{width:64}} defaultValue="5"/> <span className="tiny muted">→ soft cap, friendly</span></td></tr>
            <tr><td style={{fontWeight:600,color:"var(--wp-ink)"}}>Messages per turn</td>
              <td><input className="wp-input" style={{width:64}} defaultValue="3"/> <span className="tiny muted">→ composer locks (423)</span></td>
              <td><span className="muted">No visible limit</span> <span className="tiny muted">· silent ceiling 10</span></td></tr>
          </tbody>
        </table>
      </div>}

      <div style={{marginTop:16}}><button className="button button-primary"><Icon n="check" s={15}/> Save changes</button></div>
    </div>
  );
}

Object.assign(window,{Inbox, Thread, Contacts, Contact, Settings});
