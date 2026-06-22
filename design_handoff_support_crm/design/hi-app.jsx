/* ===== Hi-fi app: prototype chrome + router ===== */
const {useState:useStateApp, useEffect:useEffectApp} = React;

const GROUPS=[
  ["Admin · wp-admin",[["inbox","Inbox"],["thread","Thread"],["contacts","Contacts"],["contact","Contact"],["settings","Settings"]]],
  ["Customer portal",[["portal-new","New ticket"],["portal-tickets","My tickets"],["portal-thread","Thread"],
    ["portal-auth","Sign in"],["portal-expired","Expired link"],["portal-empty","Empty"],["portal-cap","Cap reached"]]],
  ["Launcher",[["launcher","Floating panel"]]],
];
const META={
  inbox:["Support Inbox","Two-pane list + reading pane · smart sort by tier & priority"],
  thread:["Agent Thread","Reply / internal-note composer + Freemius & environment sidebar"],
  contacts:["Contacts","Freemius-synced directory of customers & ticket submitters"],
  contact:["Contact detail","Profile, license state, and full ticket history"],
  settings:["Settings","Freemius · Email · Tickets & guard matrix"],
  "portal-new":["Portal · New ticket","Single entry point · seamless tier verification by email"],
  "portal-tickets":["Portal · My tickets","Authenticated list via magic-link session"],
  "portal-thread":["Portal · Thread","Auto-updating · composer lock at free-tier turn limit"],
  "portal-auth":["Portal · Sign in","Passwordless magic-link request + sent confirmation"],
  "portal-expired":["Portal · Expired link","Single-use / 48-hour link fallback"],
  "portal-empty":["Portal · Empty state","No tickets yet"],
  "portal-cap":["Portal · Open-ticket cap","Free-tier guard · 409 conflict"],
  launcher:["Floating support launcher","Site-wide bubble → in-place panel, async framing"],
};

function App(){
  const [screen,setScreen]=useStateApp(()=>localStorage.getItem("hi_screen")||"inbox");
  useEffectApp(()=>{localStorage.setItem("hi_screen",screen);},[screen]);
  const go=(s)=>{setScreen(s);window.scrollTo(0,0);};

  const adminScreens=["inbox","thread","contacts","contact","settings"];
  const isAdmin=adminScreens.includes(screen);

  let inner;
  if(screen==="inbox") inner=<Inbox go={go}/>;
  else if(screen==="thread") inner=<Thread go={go}/>;
  else if(screen==="contacts") inner=<Contacts go={go}/>;
  else if(screen==="contact") inner=<Contact go={go}/>;
  else if(screen==="settings") inner=<Settings/>;
  else if(screen==="portal-new") inner=<PortalNew go={go}/>;
  else if(screen==="portal-tickets") inner=<MyTickets go={go}/>;
  else if(screen==="portal-thread") inner=<PortalThread go={go}/>;
  else if(screen==="portal-auth") inner=<PortalAuth go={go}/>;
  else if(screen==="portal-expired") inner=<PortalExpired go={go}/>;
  else if(screen==="portal-empty") inner=<PortalEmpty go={go}/>;
  else if(screen==="portal-cap") inner=<PortalCap go={go}/>;
  else if(screen==="launcher") inner=<Launcher/>;

  const body=isAdmin?<WP sub={screen} go={go}>{inner}</WP>:inner;
  const [title,desc]=META[screen]||["",""];

  return (
    <>
      <div className="pbar">
        <div className="brand"><span className="d"/><b>SublimeTheme</b> Support CRM</div>
        <div className="stamp">Hi-fi · v1</div>
        <div className="pgroups">
          {GROUPS.map(([label,items])=>(
            <div className="pg" key={label}>
              <span className="pg-l">{label}</span>
              {items.map(([k,l])=><button key={k} className={"pill"+(screen===k?" on":"")} onClick={()=>go(k)}>{l}</button>)}
            </div>
          ))}
        </div>
      </div>
      <div className="stage">
        <div className="frame" data-screen-label={title}>
          <div className="fcap"><h2>{title}</h2><span className="d">{desc}</span>
            <span className="badge2 badge" style={{marginLeft:"auto",background:"transparent",border:"1px solid #3a4047",color:"#9aa0a6"}}>{isAdmin?"WordPress admin":screen==="launcher"?"Vendor site":"Customer portal"}</span></div>
          <div className="device">{body}</div>
        </div>
      </div>
    </>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
