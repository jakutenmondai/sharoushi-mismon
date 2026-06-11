import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ══════════════════════════════════════════
// 定数・設定
// ══════════════════════════════════════════
const SB = createClient(
  "https://sxnniucinmctlaqvkbkc.supabase.co",
  "sb_publishable_D5QFilgFhf7nn0_wcD9ExA_D2NRzHQw"
);

const SUBJS = [
  {s:"労基",f:"労働基準法"},
  {s:"安衛",f:"労働安全衛生法"},
  {s:"労災",f:"労働者災害補償保険法"},
  {s:"雇用",f:"雇用保険法"},
  {s:"徴収",f:"労働保険の保険料の徴収等に関する法律"},
  {s:"健保",f:"健康保険法"},
  {s:"厚年",f:"厚生年金保険法"},
  {s:"国年",f:"国民年金法"},
  {s:"労一",f:"労務管理その他の労働に関する一般常識"},
  {s:"社一",f:"社会保険に関する一般常識"},
];

const RANKS = [
  {id:"G",l:"G やさしい",c:"#22c55e",bg:"#dcfce7"},
  {id:"A",l:"A 基礎",    c:"#3b82f6",bg:"#dbeafe"},
  {id:"B",l:"B 普通",    c:"#6366f1",bg:"#e0e7ff"},
  {id:"C",l:"C やや難",  c:"#f59e0b",bg:"#fef3c7"},
  {id:"D",l:"D 難しい",  c:"#f97316",bg:"#ffedd5"},
  {id:"E",l:"E 激ムズ",  c:"#ef4444",bg:"#fee2e2"},
  {id:"F",l:"F 落とし穴",c:"#7c3aed",bg:"#f3e8ff"},
];

// 予備校・教材のプリセット
const SCHOOLS = ["大原","LEC","山予備","その他"];
const MATERIAL_TYPES = [
  {id:"text",  icon:"📖", label:"テキスト・参考書・法改正教材"},
  {id:"ichi",  icon:"📝", label:"一問一答問題集"},
  {id:"nendo", icon:"🏛", label:"年度別本試験過去問"},
  {id:"moshi", icon:"📋", label:"模試・答練・直前対策"},
  {id:"orig",  icon:"🏫", label:"予備校オリジナル問題"},
];

// 引っかけパターン
const PTNS = [
  {id:"abs",c:"#ef4444",bg:"#fee2e2",l:"断定表現",  sym:"◎",kw:["必ず","常に","絶対に","いかなる場合","例外なく","一律に","すべての"],tip:"例外の有無を確認"},
  {id:"bnd",c:"#f59e0b",bg:"#fef3c7",l:"境界線",    sym:"△",kw:["以上","以下","超える","未満","を超え","に満たない"],tip:"含む/含まないを確認"},
  {id:"neg",c:"#8b5cf6",bg:"#ede9fe",l:"否定逆転",  sym:"→",kw:["できる","できない","しなければならない","してはならない","要しない"],tip:"文末まで読んで判断"},
  {id:"sbj",c:"#3b82f6",bg:"#dbeafe",l:"主語すり替え",sym:"□",kw:["労働者","使用者","事業主","厚生労働大臣","都道府県知事","被保険者"],tip:"主語を丸で囲む"},
  {id:"lim",c:"#ec4899",bg:"#fce7f3",l:"限定表現",  sym:"★",kw:["のみ","だけ","に限り"],tip:"本当にそれだけ？"},
  {id:"prc",c:"#0ea5e9",bg:"#e0f2fe",l:"行政手続",  sym:"⬡",kw:["届出","許可","認可","申請","承認"],tip:"届出vs許可の違い"},
  {id:"exc",c:"#10b981",bg:"#d1fae5",l:"原則/例外",  sym:"⬡",kw:["原則として","ただし","特別の定め","を除き"],tip:"原則の消去に注意"},
  {id:"and",c:"#f97316",bg:"#ffedd5",l:"OR/AND",    sym:"◇",kw:["または","かつ","及び","若しくは"],tip:"OR=どちらかOK,AND=両方必要"},
];
const REV_KW=["法改正","改正","令和","R5","R6","R7","2024年","2025年","拡大","引き上げ","新設","産後パパ育休","週10時間","月60時間"];

function toDay(){return new Date().toISOString().slice(0,10);}
function genId(){return Date.now()+"_"+Math.random().toString(36).slice(2,6);}
function detectPtns(txt){return PTNS.filter(p=>p.kw.some(k=>(txt||"").includes(k))).map(p=>p.id);}
function detectRev(txt){return REV_KW.some(k=>(txt||"").includes(k));}
function extractRank(txt){const m=(txt||"").match(/RANK:([GABCDEF])/);return m?m[1]:"B";}

// 試験日（8月第4日曜）
function examDate(){
  const now=new Date();
  function get4thSun(y){let n=0;for(let d=1;d<=31;d++){const dt=new Date(y,7,d);if(dt.getMonth()!==7)break;if(dt.getDay()===0&&++n===4)return dt;}return new Date(y,7,25);}
  let ex=get4thSun(now.getFullYear());
  if(now>ex)ex=get4thSun(now.getFullYear()+1);
  return{exam:ex,days:Math.max(0,Math.floor((ex-now)/86400000))};
}
function fmtD(d){return`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（日）`;}

// ハイライト
function HL({text}){
  if(!text)return null;
  const marks=[];
  PTNS.forEach(p=>p.kw.forEach(kw=>{let i=0;while((i=text.indexOf(kw,i))!==-1){marks.push({s:i,e:i+kw.length,c:p.c,bg:p.bg,sym:p.sym,l:p.l,tip:p.tip});i+=kw.length;}}));
  REV_KW.forEach(kw=>{let i=0;while((i=text.indexOf(kw,i))!==-1){marks.push({s:i,e:i+kw.length,c:"#7c3aed",bg:"#f3e8ff",sym:"🆕",l:"法改正",tip:"施行状況確認"});i+=kw.length;}});
  if(!marks.length)return<>{text}</>;
  marks.sort((a,b)=>a.s-b.s||b.e-a.e);
  const mg=[];let cur=null;
  for(const m of marks){if(!cur){cur={...m};continue;}if(m.s<cur.e)continue;mg.push(cur);cur={...m};}
  if(cur)mg.push(cur);
  const out=[];let pos=0;
  mg.forEach((m,i)=>{
    if(pos<m.s)out.push(<span key={"t"+i}>{text.slice(pos,m.s)}</span>);
    out.push(<span key={"m"+i} title={`【${m.l}】${m.tip}`} style={{background:m.bg,color:m.c,fontWeight:900,borderRadius:3,padding:"0 2px",border:`1.5px solid ${m.c}55`,cursor:"help"}}><sup style={{fontSize:8}}>{m.sym}</sup>{text.slice(m.s,m.e)}</span>);
    pos=m.e;
  });
  if(pos<text.length)out.push(<span key="last">{text.slice(pos)}</span>);
  return<>{out}</>;
}

// ══════════════════════════════════════════
// ストレージ
// ══════════════════════════════════════════
const SK="sharoushi_v8";
function load(){try{return JSON.parse(localStorage.getItem(SK)||"null")||{qs:[],books:[]};}catch{return{qs:[],books:[]};}}
function save(st){localStorage.setItem(SK,JSON.stringify(st));}

// AI
const SYS=`あなたは社会保険労務士試験の最上位専門家です。
必ず以下を含めてください：
・引っかけパターン名と印のつけ方（◎△→□★⬡◇）
・テキストの重点章節
・法改正がある場合は【🆕法改正】と明記
・過去57回の出題実績
・最後に必ず「RANK:X」（X=G/A/B/C/D/E/F）

## 🎯 問われているテーマ
## ⚠️ 引っかけパターンと印のつけ方
## ✅ 正解と根拠（条文・通達・判例）
## 📖 詳細解説（数字・期間・要件・例外を網羅）
## 📊 過去57回の出題実績
## 🆕 法改正ポイント
## 📌 テキスト該当箇所
## 💡 試験対策メモ
RANK:X`;

async function callAI(messages){
  const r=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:SYS,messages}),
  });
  const d=await r.json();
  if(d.error)throw new Error(d.error.message);
  return d.content?.map(b=>b.text||"").join("")||"";
}

// ══════════════════════════════════════════
// メインアプリ
// ══════════════════════════════════════════
export default function App(){
  const[st,setSt]=useState(load);
  const[page,setPage]=useState("dash");
  const[cd,setCd]=useState(examDate);
  const[selQ,setSelQ]=useState(null);     // 選択中の問題
  const[showAdd,setShowAdd]=useState(false); // 登録モーダル
  const[showBatch,setShowBatch]=useState(false); // 一括入力
  const[showBooks,setShowBooks]=useState(false); // 教材管理
  const[showUpdate,setShowUpdate]=useState(false); // 更新手順
  const[aiBusy,setAiBusy]=useState(false);
  const[pdfMap,setPdfMap]=useState({});    // bookId→{b64,name}
  const[filter,setFilter]=useState({subj:"all",rank:"all",ptn:"all",q:""});
  const imgRef=useRef();
  const importRef=useRef();

  useEffect(()=>{const id=setInterval(()=>setCd(examDate()),60000);return()=>clearInterval(id);},[]);

  const mut=useCallback(fn=>setSt(prev=>{const next=fn(prev);save(next);return next;}),[]);

  // 問題を保存（解説だけ保存。ミス記録は別）
  const saveQ=async q=>{
    const ptns=detectPtns((q.qText||"")+(q.exp||""));
    const hasRev=detectRev(q.exp||"");
    const rank=q.exp?(extractRank(q.exp)||q.rank||"B"):(q.rank||"B");
    const final={...q,ptns,hasRev,rank};
    mut(s=>{
      const idx=s.qs.findIndex(x=>x.id===q.id);
      return{...s,qs:idx>=0?s.qs.map((x,i)=>i===idx?final:x):[final,...s.qs]};
    });
    // Supabase同期
    if(final.nenNo&&(final.qText||final.exp)){
      try{await SB.from("shared_questions").upsert({
        id:final.nenNo,subject:final.subj,nendo_no:final.nenNo,
        question_text:final.qText||null,explanation:final.exp||null,
        ptns:final.ptns,has_rev:final.hasRev,updated_at:new Date().toISOString(),
      });}catch(e){console.error(e);}
    }
    setShowAdd(false);
  };

  // ❌ または ✅ を記録
  const record=(id,r)=>mut(s=>({
    ...s,qs:s.qs.map(q=>q.id!==id?q:{
      ...q,
      missCount:r==="×"?q.missCount+1:q.missCount,
      history:[...(q.history||[]),{date:toDay(),r}],
    })
  }));

  // 一括ミス問入力
  const batchSave=(lines,subj)=>{
    const newQs=lines.filter(l=>l.trim()).map(line=>{
      const nenNo=line.match(/[RH]\d{2}-\d{2}[A-Z]/)?.[0]||"";
      const qNo=line.match(/No\.?\d+/)?.[0]||"";
      return{
        id:genId(),subj,nenNo,qNo,
        rank:"B",missCount:1,
        history:[{date:toDay(),r:"×"}],
        qText:"",exp:"",memo:"",ptns:[],hasRev:false,
        bookId:null,createdAt:new Date().toISOString(),
      };
    });
    mut(s=>({...s,qs:[...newQs,...s.qs]}));
    setShowBatch(false);
  };

  const deleteQ=id=>{
    if(!confirm("削除しますか？"))return;
    mut(s=>({...s,qs:s.qs.filter(q=>q.id!==id)}));
    if(selQ?.id===id)setSelQ(null);
  };

  const exportData=()=>{
    const blob=new Blob([JSON.stringify(st,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);
    a.download=`sharoshi_${toDay()}.json`;a.click();
  };
  const importData=e=>{
    const file=e.target.files?.[0];if(!file)return;
    const r=new FileReader();
    r.onload=ev=>{
      try{
        const d=JSON.parse(ev.target.result);
        if(!confirm(`${(d.qs||[]).length}件をインポートします`))return;
        mut(s=>({
          ...s,
          qs:[...s.qs,...(d.qs||[]).filter(q=>!s.qs.find(x=>x.id===q.id))],
          books:[...s.books,...(d.books||[]).filter(b=>!s.books.find(x=>x.id===b.id))],
        }));
        alert("完了！");
      }catch{alert("ファイルが不正です");}
    };
    r.readAsText(file);e.target.value="";
  };

  const visQs=st.qs
    .filter(q=>filter.subj==="all"||q.subj===filter.subj)
    .filter(q=>filter.rank==="all"||q.rank===filter.rank)
    .filter(q=>filter.ptn==="all"||(q.ptns||[]).includes(filter.ptn))
    .filter(q=>!filter.q||JSON.stringify(q).toLowerCase().includes(filter.q.toLowerCase()))
    .sort((a,b)=>b.missCount-a.missCount);

  // 科目別正答率
  const subjStats=SUBJS.map(sub=>{
    const qs=st.qs.filter(q=>q.subj===sub.s);
    const hist=qs.flatMap(q=>q.history||[]);
    const cor=hist.filter(h=>h.r==="○").length;
    return{...sub,total:hist.length,cor,rate:hist.length?Math.round(cor/hist.length*100):null,count:qs.length};
  });

  return(
    <div style={{fontFamily:"'Hiragino Sans','Yu Gothic',sans-serif",minHeight:"100vh",background:"#f1f5f9",color:"#1e293b"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        .hov{transition:.15s;} .hov:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.1);}
        @keyframes pr{0%{width:0}80%{width:90%}100%{width:96%}}
        .pr{animation:pr 3s ease-out forwards;height:100%;background:#0f2744;border-radius:3px;}
        select,input,textarea{outline:none;font-family:inherit;}
        select:focus,input:focus,textarea:focus{border-color:#3b82f6!important;}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:2px;}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:100;padding:12px;}
        .modal{background:#fff;border-radius:14px;padding:20px;width:100%;max-width:700px;max-height:90vh;overflow-y:auto;}
      `}</style>

      {/* ─ ヘッダー ─ */}
      <div style={{background:"linear-gradient(135deg,#0f2744,#1a3a72)",padding:"10px 16px"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:38,height:38,borderRadius:9,background:"#f59e0b",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,color:"#fff"}}>社</div>
            <div>
              <div style={{fontSize:15,fontWeight:900,color:"#fff"}}>ミス問ノート</div>
              <div style={{fontSize:8,color:"#93c5fd"}}>社労士試験・弱点克服トラッカー</div>
            </div>
          </div>
          {/* カウントダウン */}
          <div style={{background:"rgba(255,255,255,.12)",borderRadius:9,padding:"6px 12px",textAlign:"center"}}>
            <div style={{fontSize:8,color:"#93c5fd"}}>{fmtD(cd.exam)}</div>
            <div style={{fontSize:24,fontWeight:900,color:"#f59e0b",lineHeight:1}}>{cd.days}<span style={{fontSize:10,color:"#fde68a",marginLeft:2}}>日</span></div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
            {[["登録",st.qs.length,"#fff"],["総ミス",st.qs.reduce((s,q)=>s+q.missCount,0),"#fca5a5"],["要注意",st.qs.filter(q=>q.missCount>=5).length,"#fde68a"]].map(([l,n,c])=>(
              <div key={l} style={{textAlign:"center"}}>
                <div style={{fontSize:16,fontWeight:900,color:c,lineHeight:1}}>{n}</div>
                <div style={{fontSize:8,color:"#bfdbfe"}}>{l}</div>
              </div>
            ))}
            {/* 更新手順ボタン */}
            <button onClick={()=>setShowUpdate(true)} title="更新手順" style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:7,padding:"5px 10px",fontSize:10,color:"#e0f2fe",cursor:"pointer",fontWeight:700}}>
              📋 更新手順
            </button>
          </div>
        </div>
      </div>

      {/* ─ NAV ─ */}
      <div style={{background:"#fff",borderBottom:"2px solid #e2e8f0",overflowX:"auto"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",gap:0}}>
          {[["dash","🏠 ダッシュボード"],["list","📋 ミス問一覧"],["shared","🌐 共有問題"]].map(([t,l])=>(
            <button key={t} onClick={()=>setPage(t)}
              style={{padding:"10px 14px",border:"none",background:"none",cursor:"pointer",fontSize:12,fontWeight:700,color:page===t?"#0f2744":"#64748b",borderBottom:page===t?"3px solid #0f2744":"3px solid transparent",whiteSpace:"nowrap"}}>
              {l}
            </button>
          ))}
          <div style={{marginLeft:"auto",display:"flex",gap:0}}>
            <button onClick={()=>setShowBatch(true)} style={{padding:"10px 12px",border:"none",background:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:"#6366f1"}}>📦 一括入力</button>
            <button onClick={()=>setShowAdd(true)} style={{padding:"10px 12px",border:"none",background:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:"#16a34a"}}>➕ 1問登録</button>
            <button onClick={()=>setShowBooks(true)} style={{padding:"10px 12px",border:"none",background:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:"#64748b"}}>📚 教材管理</button>
            <button onClick={exportData} style={{padding:"10px 10px",border:"none",background:"none",cursor:"pointer",fontSize:11,color:"#64748b"}}>📤</button>
            <button onClick={()=>importRef.current?.click()} style={{padding:"10px 10px",border:"none",background:"none",cursor:"pointer",fontSize:11,color:"#64748b"}}>📥</button>
            <input ref={importRef} type="file" accept=".json" style={{display:"none"}} onChange={importData}/>
          </div>
        </div>
      </div>

      {/* ─ 凡例 ─ */}
      <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"3px 14px",overflowX:"auto"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:9,color:"#64748b",fontWeight:700,flexShrink:0}}>印：</span>
          {PTNS.map(p=>(
            <span key={p.id} title={p.tip} style={{fontSize:9,background:p.bg,color:p.c,borderRadius:8,padding:"1px 6px",fontWeight:700,cursor:"help",border:`1px solid ${p.c}33`}}>
              <sup>{p.sym}</sup>{p.l}
            </span>
          ))}
          <span style={{fontSize:9,background:"#f3e8ff",color:"#7c3aed",borderRadius:8,padding:"1px 6px",fontWeight:700}}>🆕法改正</span>
        </div>
      </div>

      {/* ─ ページ ─ */}
      <div style={{maxWidth:1200,margin:"0 auto",padding:"14px 12px"}}>
        {page==="dash"&&<DashPage qs={st.qs} cd={cd} subjStats={subjStats} onAdd={()=>setShowAdd(true)} onBatch={()=>setShowBatch(true)}/>}
        {page==="list"&&(
          <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
            <div style={{flex:selQ?"0 0 360px":"1",maxWidth:selQ?400:"100%"}}>
              <ListPage qs={visQs} filter={filter} setFilter={setFilter} selId={selQ?.id}
                onSel={q=>setSelQ(q)} onAdd={()=>setShowAdd(true)}/>
            </div>
            {selQ&&(
              <div style={{flex:"1 1 0",minWidth:0}}>
                <DetPage q={selQ} books={st.books} pdfMap={pdfMap} setPdfMap={setPdfMap}
                  onRecord={r=>{record(selQ.id,r);setSelQ(s=>({...s,history:[...(s.history||[]),{date:toDay(),r}],missCount:r==="×"?s.missCount+1:s.missCount}));}}
                  onEdit={()=>{setShowAdd(true);}}
                  onDelete={()=>deleteQ(selQ.id)}
                  onClose={()=>setSelQ(null)}
                  onSave={saveQ}
                  aiBusy={aiBusy} setAiBusy={setAiBusy}
                  imgRef={imgRef}/>
              </div>
            )}
          </div>
        )}
        {page==="shared"&&<SharedPage/>}
      </div>

      {/* ─ モーダル群 ─ */}
      {showAdd&&(
        <AddModal
          books={st.books} pdfMap={pdfMap} setPdfMap={setPdfMap}
          imgRef={imgRef} aiBusy={aiBusy} setAiBusy={setAiBusy}
          onSave={saveQ} onClose={()=>setShowAdd(false)}
          initQ={selQ&&page==="list"?selQ:null}
        />
      )}
      {showBatch&&<BatchModal books={st.books} onSave={batchSave} onClose={()=>setShowBatch(false)}/>}
      {showBooks&&<BooksModal books={st.books} mut={mut} onClose={()=>setShowBooks(false)}/>}
      {showUpdate&&<UpdateModal onClose={()=>setShowUpdate(false)}/>}

      <input ref={imgRef} type="file" accept="image/*" style={{display:"none"}}
        onChange={e=>{const f=e.target.files?.[0];if(f&&window.__aiImageCb)window.__aiImageCb(f);e.target.value="";}}/>
    </div>
  );
}

// ══════════════════════════════════════════
// ダッシュボード
// ══════════════════════════════════════════
function DashPage({qs,cd,subjStats,onAdd,onBatch}){
  const miss5=qs.filter(q=>q.missCount>=5).sort((a,b)=>b.missCount-a.missCount).slice(0,5);
  const week=qs.filter(q=>{const l=q.history?.slice(-1)[0];return l?.r==="×"&&new Date()-new Date(l.date)<7*864e5;}).slice(0,6);
  return(
    <div>
      {/* 試験日カード */}
      <div style={{background:"linear-gradient(135deg,#0f2744,#1a3a72)",borderRadius:14,padding:"14px 18px",marginBottom:14,display:"flex",gap:14,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:10,color:"#93c5fd",marginBottom:2}}>社会保険労務士試験 本試験</div>
          <div style={{fontSize:16,fontWeight:900,color:"#fff",marginBottom:3}}>{fmtD(cd.exam)}</div>
          <div style={{fontSize:12,color:"#fde68a",fontWeight:700}}>あと <span style={{fontSize:24}}>{cd.days}</span> 日！</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onBatch} style={{background:"#6366f1",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}}>📦 一括でミス問入力</button>
          <button onClick={onAdd} style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}}>➕ 1問登録</button>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        {/* 科目別正答率 */}
        <div style={C.card}>
          <div style={C.cardT}>📊 科目別 正答率・ミス問数</div>
          {subjStats.map(s=>(
            <div key={s.s} style={{display:"flex",alignItems:"center",gap:6,marginBottom:7}}>
              <span style={{fontSize:10,fontWeight:900,color:"#0f2744",width:28,flexShrink:0}}>{s.s}</span>
              <div style={{flex:1}}>
                <div style={{background:"#f1f5f9",borderRadius:3,height:7,overflow:"hidden"}}>
                  {s.rate!==null&&<div style={{height:"100%",background:s.rate>=70?"#22c55e":s.rate>=40?"#f59e0b":"#ef4444",width:`${s.rate}%`,borderRadius:3}}/>}
                </div>
              </div>
              <span style={{fontSize:9,color:s.rate!==null?(s.rate>=70?"#16a34a":s.rate>=40?"#d97706":"#dc2626"):"#94a3b8",width:36,textAlign:"right",flexShrink:0}}>
                {s.rate!==null?`${s.rate}%`:"−"}
              </span>
              <span style={{fontSize:9,color:"#64748b",width:28,textAlign:"right",flexShrink:0}}>{s.count}問</span>
            </div>
          ))}
        </div>

        {/* 要注意TOP */}
        <div style={C.card}>
          <div style={C.cardT}>🔴 要注意問題 TOP（ミス5回以上）</div>
          {miss5.length===0
            ?<div style={{color:"#94a3b8",fontSize:12,textAlign:"center",padding:"12px 0"}}>要注意問題はまだありません👍</div>
            :miss5.map(q=>{
              const rk=RANKS.find(r=>r.id===q.rank)||RANKS[2];
              return(
                <div key={q.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,padding:"5px 8px",background:"#fef2f2",borderRadius:7,border:"1px solid #fca5a5"}}>
                  <span style={{fontSize:9,background:rk.bg,color:rk.c,borderRadius:4,padding:"1px 5px",fontWeight:900,flexShrink:0}}>{rk.id}</span>
                  <span style={{fontSize:9,background:"#e0f2fe",color:"#0369a1",borderRadius:4,padding:"1px 5px",fontWeight:700,flexShrink:0}}>{q.subj}</span>
                  <span style={{fontSize:10,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:700}}>{q.nenNo||q.qNo||"番号未入力"}</span>
                  <span style={{fontSize:10,background:"#ef4444",color:"#fff",borderRadius:10,padding:"1px 7px",fontWeight:900,flexShrink:0}}>×{q.missCount}</span>
                </div>
              );
            })
          }
        </div>

        {/* 直近7日 */}
        <div style={C.card}>
          <div style={C.cardT}>📅 直近7日のミス</div>
          {week.length===0
            ?<div style={{color:"#94a3b8",fontSize:12,textAlign:"center",padding:"12px 0"}}>直近7日のミスはありません</div>
            :week.map(q=>(
              <div key={q.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5,padding:"4px 8px",background:"#fffbeb",borderRadius:7,border:"1px solid #fde68a"}}>
                <span style={{fontSize:9,background:"#e0f2fe",color:"#0369a1",borderRadius:4,padding:"1px 5px",fontWeight:700,flexShrink:0}}>{q.subj}</span>
                <span style={{fontSize:10,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{q.nenNo||q.qNo||"番号未入力"}</span>
                <span style={{fontSize:9,color:"#94a3b8",flexShrink:0}}>{q.history?.slice(-1)[0]?.date}</span>
              </div>
            ))
          }
        </div>

        {/* ランク別 */}
        <div style={C.card}>
          <div style={C.cardT}>⭐ ランク別登録数</div>
          {RANKS.map(r=>{const n=qs.filter(q=>q.rank===r.id).length;return(
            <div key={r.id} style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
              <span style={{fontSize:9,fontWeight:900,color:r.c,background:r.bg,borderRadius:5,padding:"1px 7px",width:72,textAlign:"center"}}>{r.l}</span>
              <div style={{flex:1,background:"#f1f5f9",borderRadius:3,height:7,overflow:"hidden"}}>
                <div style={{height:"100%",background:r.c,width:`${qs.length?(n/qs.length*100):0}%`,borderRadius:3}}/>
              </div>
              <span style={{fontSize:10,fontWeight:700,color:r.c,width:20,textAlign:"right"}}>{n}</span>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// ミス問一覧
// ══════════════════════════════════════════
function ListPage({qs,filter,setFilter,selId,onSel,onAdd}){
  const sf=v=>setFilter(f=>({...f,...v}));
  return(
    <div style={C.panel}>
      <input value={filter.q} onChange={e=>sf({q:e.target.value})} placeholder="🔍 番号・科目・メモ検索…" style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e2e8f0",borderRadius:9,fontSize:13,marginBottom:7,background:"#f8fafc"}}/>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:7}}>
        <select value={filter.subj} onChange={e=>sf({subj:e.target.value})} style={C.sel}>
          <option value="all">全科目</option>
          {SUBJS.map(s=><option key={s.s} value={s.s}>{s.s}</option>)}
        </select>
        <select value={filter.rank} onChange={e=>sf({rank:e.target.value})} style={C.sel}>
          <option value="all">全ランク</option>
          {RANKS.map(r=><option key={r.id} value={r.id}>{r.l}</option>)}
        </select>
        <select value={filter.ptn} onChange={e=>sf({ptn:e.target.value})} style={C.sel}>
          <option value="all">全パターン</option>
          {PTNS.map(p=><option key={p.id} value={p.id}>{p.l}</option>)}
        </select>
      </div>
      <div style={{fontSize:10,color:"#94a3b8",marginBottom:6}}>{qs.length}件</div>
      {qs.length===0
        ?<div style={{textAlign:"center",padding:"30px 0",color:"#94a3b8"}}>
            <div style={{fontSize:32,marginBottom:8}}>📝</div>
            <div style={{marginBottom:12,fontSize:13}}>ミス問がまだありません</div>
            <button onClick={onAdd} style={C.btnP}>➕ 最初の問題を登録</button>
          </div>
        :<div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:"72vh",overflowY:"auto"}}>
          {qs.map(q=><QCard key={q.id} q={q} sel={q.id===selId} onClick={()=>onSel(q)}/>)}
        </div>
      }
    </div>
  );
}

function QCard({q,sel,onClick}){
  const acc=q.missCount>=5?"#ef4444":q.missCount>=3?"#f59e0b":"#22c55e";
  const bg=sel?"#eff6ff":q.missCount>=5?"#fef2f2":q.missCount>=3?"#fffbeb":"#fff";
  const rk=RANKS.find(r=>r.id===q.rank)||RANKS[2];
  const pats=(q.ptns||[]).map(id=>PTNS.find(p=>p.id===id)).filter(Boolean);
  const hist=q.history||[];
  const cor=hist.filter(h=>h.r==="○").length;
  const rate=hist.length?Math.round(cor/hist.length*100):null;
  const last=hist.slice(-1)[0];
  return(
    <div className="hov" onClick={onClick} style={{borderRadius:9,padding:"9px 11px",cursor:"pointer",background:bg,borderLeft:`4px solid ${acc}`,outline:sel?"2px solid #3b82f6":"none",boxShadow:"0 1px 3px rgba(0,0,0,.06)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
        <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:8,background:"#0f2744",color:"#fff",borderRadius:4,padding:"1px 5px",fontWeight:700}}>{q.subj}</span>
          <span style={{fontSize:8,background:rk.bg,color:rk.c,borderRadius:4,padding:"1px 5px",fontWeight:900}}>{rk.id}</span>
          {q.hasRev&&<span style={{fontSize:8,background:"#f3e8ff",color:"#7c3aed",borderRadius:4,padding:"1px 4px",fontWeight:700}}>🆕</span>}
        </div>
        <span style={{fontSize:10,background:acc,color:"#fff",borderRadius:20,padding:"1px 7px",fontWeight:900}}>×{q.missCount}</span>
      </div>
      {/* 問題番号表示 */}
      <div style={{fontSize:11,fontWeight:700,marginBottom:2,color:"#0f2744"}}>
        {q.nenNo&&<span style={{background:"#e0f2fe",color:"#0369a1",borderRadius:4,padding:"1px 6px",marginRight:4,fontSize:10}}>{q.nenNo}</span>}
        {q.qNo&&<span style={{color:"#64748b",fontSize:10}}>No.{q.qNo}</span>}
        {!q.nenNo&&!q.qNo&&<span style={{color:"#94a3b8",fontSize:10}}>番号未入力</span>}
      </div>
      {pats.length>0&&(
        <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:2}}>
          {pats.map(p=><span key={p.id} style={{fontSize:8,background:p.bg,color:p.c,borderRadius:5,padding:"0 5px",fontWeight:700}}><sup>{p.sym}</sup>{p.l}</span>)}
        </div>
      )}
      {q.qText&&<div style={{fontSize:10,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><HL text={q.qText.slice(0,50)}/>{q.qText.length>50?"…":""}</div>}
      <div style={{display:"flex",justifyContent:"space-between",marginTop:2}}>
        <span style={{fontSize:9,color:rate!==null?(rate>=70?"#16a34a":rate>=40?"#f59e0b":"#dc2626"):"#94a3b8"}}>{rate!==null?`正答率${rate}%`:""}</span>
        <span style={{fontSize:9,color:"#94a3b8"}}>{last?`最終:${last.date} ${last.r}`:""}</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// 問題詳細（AI解説・正誤ボタン）
// ══════════════════════════════════════════
function DetPage({q,books,pdfMap,setPdfMap,onRecord,onEdit,onDelete,onClose,onSave,aiBusy,setAiBusy,imgRef}){
  const[localQ,setLocalQ]=useState(q);
  const[aiOut,setAiOut]=useState(q.exp||"");
  const[aiErr,setAiErr]=useState("");
  const[editing,setEditing]=useState(false);
  const pdfRef=useRef();

  useEffect(()=>{setLocalQ(q);setAiOut(q.exp||"");setEditing(false);},[q.id]);

  const rk=RANKS.find(r=>r.id===q.rank)||RANKS[2];
  const pats=(q.ptns||[]).map(id=>PTNS.find(p=>p.id===id)).filter(Boolean);
  const hist=q.history||[];
  const cor=hist.filter(h=>h.r==="○").length;
  const rate=hist.length?Math.round(cor/hist.length*100):null;
  const last=hist.slice(-1)[0];
  const book=books?.find(b=>b.id===q.bookId);
  const pdfKey=q.bookId||"__tmp";

  const runAI=async()=>{
    setAiBusy(true);setAiErr("");
    try{
      // 共有DBから取得試み
      if(q.nenNo){
        const{data}=await SB.from("shared_questions").select("*").eq("nendo_no",q.nenNo).single();
        if(data?.explanation){setAiOut(data.explanation);setAiBusy(false);return;}
      }
      const pdfB64=pdfMap[pdfKey]?.b64;
      let content;
      if(pdfB64&&q.inputMode==="pdf"){
        const pg=localQ.pageRange?`${localQ.pageRange}ページを解説`:`問題番号「${q.nenNo||q.qNo}」を見つけて問題文も引用して解説`;
        content=[{type:"document",source:{type:"base64",media_type:"application/pdf",data:pdfB64}},{type:"text",text:`科目:${q.subj} ${pg}`}];
      }else if(q.qText){
        content=`【科目】${q.subj}\n【年度番号】${q.nenNo||"未入力"}\n【問題文】\n${q.qText}`;
      }else{
        content=`【科目】${q.subj}\n【年度番号】${q.nenNo||"未入力"}\n【問題集番号】${q.qNo||"未入力"}\n${book?`【問題集】${book.name}`:""}`;
      }
      const r=await callAI([{role:"user",content}]);
      setAiOut(r);
      onSave({...q,exp:r});
    }catch(e){setAiErr("エラー: "+e.message);}
    setAiBusy(false);
  };

  const handlePdf=e=>{
    const files=Array.from(e.target.files||[]);
    files.forEach(file=>{
      const r2=new FileReader();
      r2.onload=ev=>setPdfMap(m=>({...m,[pdfKey]:{b64:ev.target.result.split(",")[1],name:file.name}}));
      r2.readAsDataURL(file);
    });
    e.target.value="";
  };

  const renderExp=text=>{
    if(!text)return null;
    const secs=[];let cur=null;
    for(const line of text.split("\n")){
      if(line.startsWith("## ")){if(cur)secs.push(cur);cur={title:line.slice(3).trim(),body:[]};}
      else if(cur)cur.body.push(line);
      else{cur={title:"",body:[line]};}
    }
    if(cur)secs.push(cur);
    return secs.map((s,i)=>{
      const isRev=s.title.includes("法改正");
      const txt=s.body.join("\n").trim().replace(/RANK:[GABCDEF]/g,"");
      if(!txt&&!s.title)return null;
      return(
        <div key={i} style={{marginBottom:10}}>
          {s.title&&<div style={{fontSize:11,fontWeight:900,marginBottom:4,padding:"3px 8px",borderRadius:5,background:isRev?"#f3e8ff":"#eff6ff",color:isRev?"#7c3aed":"#1d4ed8",borderLeft:`3px solid ${isRev?"#7c3aed":"#3b82f6"}`}}>{s.title}{isRev&&<span style={{marginLeft:5,fontSize:9,background:"#7c3aed",color:"#fff",borderRadius:3,padding:"1px 5px"}}>要確認</span>}</div>}
          <div style={{fontSize:12,lineHeight:1.9,whiteSpace:"pre-wrap"}}><HL text={txt}/></div>
        </div>
      );
    });
  };

  return(
    <div style={C.panel}>
      {/* ヘッダー */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          <span style={{fontSize:9,background:"#0f2744",color:"#fff",borderRadius:5,padding:"2px 7px",fontWeight:700}}>{q.subj}</span>
          <span style={{fontSize:9,background:rk.bg,color:rk.c,borderRadius:5,padding:"2px 7px",fontWeight:900}}>{rk.l}</span>
          {rate!==null&&<span style={{fontSize:9,background:"#eff6ff",color:"#1d4ed8",borderRadius:5,padding:"2px 7px",fontWeight:700}}>正答率{rate}%</span>}
          {q.hasRev&&<span style={{fontSize:9,background:"#f3e8ff",color:"#7c3aed",borderRadius:20,padding:"2px 7px",fontWeight:700}}>🆕法改正</span>}
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#64748b"}}>✕</button>
      </div>

      {/* 問題情報 */}
      <div style={{marginBottom:10,padding:"8px 10px",background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"}}>
        {q.nenNo&&<div style={{fontSize:12,fontWeight:900,color:"#0369a1",marginBottom:2}}>年度番号: {q.nenNo}</div>}
        {q.qNo&&<div style={{fontSize:11,color:"#64748b",marginBottom:2}}>問題集番号: No.{q.qNo}</div>}
        {book&&<div style={{fontSize:10,color:"#64748b",marginBottom:2}}>📚 {book.name}</div>}
        {last&&<div style={{fontSize:10,color:"#94a3b8"}}>最後: <strong>{last.date}</strong>（{last.r}）</div>}
      </div>

      {/* 引っかけパターン */}
      {pats.length>0&&(
        <div style={{marginBottom:10,padding:"7px 10px",background:"#fff7ed",borderRadius:8,border:"1px solid #fed7aa"}}>
          <div style={{fontSize:9,fontWeight:900,color:"#92400e",marginBottom:4}}>⚠️ 引っかけパターン</div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {pats.map(p=><span key={p.id} title={p.tip} style={{background:p.bg,border:`1.5px solid ${p.c}`,color:p.c,borderRadius:7,padding:"2px 7px",fontSize:9,fontWeight:700,cursor:"help"}}><sup>{p.sym}</sup>{p.l} →{p.tip}</span>)}
          </div>
        </div>
      )}

      {/* 問題文 */}
      {q.qText&&(
        <div style={{marginBottom:10}}>
          <div style={{fontSize:9,fontWeight:900,color:"#64748b",marginBottom:3}}>📄 問題文</div>
          <div style={{fontSize:13,lineHeight:2,background:"#f8fafc",padding:"9px 11px",borderRadius:8,whiteSpace:"pre-wrap",maxHeight:200,overflowY:"auto",border:"1px solid #e2e8f0"}}><HL text={q.qText}/></div>
        </div>
      )}

      {/* ❌ ✅ ボタン */}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button onClick={()=>onRecord("×")} style={{flex:1,background:"#fee2e2",color:"#dc2626",border:"2px solid #fca5a5",borderRadius:8,padding:"10px",fontSize:13,fontWeight:900,cursor:"pointer"}}>❌ また間違えた</button>
        <button onClick={()=>onRecord("○")} style={{flex:1,background:"#dcfce7",color:"#16a34a",border:"2px solid #86efac",borderRadius:8,padding:"10px",fontSize:13,fontWeight:900,cursor:"pointer"}}>✅ 正解した</button>
      </div>

      {/* AI解説エリア */}
      <div style={{marginBottom:12}}>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
          <div style={{fontSize:9,fontWeight:900,color:"#64748b"}}>✨ AI解説</div>
          <button onClick={runAI} disabled={aiBusy} style={{fontSize:10,background:"#0f2744",color:"#fff",border:"none",borderRadius:6,padding:"3px 10px",cursor:"pointer",fontWeight:700,opacity:aiBusy?.6:1}}>
            {aiBusy?"⏳ 生成中…":"🤖 AI解説を取得"}
          </button>
          <button onClick={()=>pdfRef.current?.click()} style={{fontSize:10,background:"#0369a1",color:"#fff",border:"none",borderRadius:6,padding:"3px 10px",cursor:"pointer",fontWeight:700}}>📄 PDFをアップ</button>
          <button onClick={()=>{window.__aiImageCb=async file=>{setAiBusy(true);const r=new FileReader();r.onload=async ev=>{try{const b64=ev.target.result.split(",")[1];const res=await callAI([{role:"user",content:[{type:"image",source:{type:"base64",media_type:file.type,data:b64}},{type:"text",text:`この社労士試験問題を解説。科目:${q.subj}`}]}]);setAiOut(res);onSave({...q,exp:res});}catch(e){setAiErr("エラー: "+e.message);}setAiBusy(false);};r.readAsDataURL(file);};imgRef.current?.click();}} style={{fontSize:10,background:"#7c3aed",color:"#fff",border:"none",borderRadius:6,padding:"3px 10px",cursor:"pointer",fontWeight:700}}>📷 画像</button>
        </div>
        {aiBusy&&<div style={{height:3,background:"#e2e8f0",borderRadius:3,overflow:"hidden",marginBottom:6}}><div className="pr"/></div>}
        {aiErr&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:7,padding:8,fontSize:11,color:"#dc2626",marginBottom:6}}>{aiErr}</div>}
        {pdfMap[pdfKey]&&<div style={{fontSize:10,color:"#166534",background:"#f0fdf4",borderRadius:6,padding:"4px 8px",marginBottom:6}}>📄 {pdfMap[pdfKey].name}</div>}
        {aiOut?(
          <div style={{maxHeight:380,overflowY:"auto",background:"#f8fafc",borderRadius:10,padding:12,border:"1px solid #e2e8f0"}}>
            {renderExp(aiOut)}
          </div>
        ):(
          <div style={{padding:"20px",textAlign:"center",color:"#94a3b8",fontSize:12,background:"#f8fafc",borderRadius:10,border:"1px solid #e2e8f0"}}>
            「AI解説を取得」ボタンでいつでも解説を表示できます
          </div>
        )}
      </div>

      {/* メモ */}
      {q.memo&&<div style={{marginBottom:10}}><div style={{fontSize:9,fontWeight:900,color:"#64748b",marginBottom:3}}>📝 メモ</div><div style={{fontSize:12,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{q.memo}</div></div>}

      {/* 解答履歴 */}
      <div style={{marginBottom:12}}>
        <div style={{fontSize:9,fontWeight:900,color:"#64748b",marginBottom:4}}>📊 解答履歴</div>
        {hist.length===0
          ?<div style={{fontSize:10,color:"#94a3b8"}}>まだ解答記録がありません（❌か✅を押すと記録されます）</div>
          :<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {hist.slice().reverse().slice(0,30).map((h,i)=>(
              <span key={i} style={{fontSize:10,fontWeight:700,display:"flex",flexDirection:"column",alignItems:"center",background:"#f8fafc",borderRadius:5,padding:"2px 5px",color:h.r==="○"?"#16a34a":"#dc2626"}}>
                {h.r}<span style={{fontSize:8,color:"#94a3b8"}}>{h.date.slice(5)}</span>
              </span>
            ))}
          </div>
        }
      </div>

      <div style={{display:"flex",gap:7,justifyContent:"flex-end"}}>
        <button onClick={onDelete} style={{background:"#fef2f2",color:"#dc2626",border:"1.5px solid #fca5a5",borderRadius:7,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}}>🗑 削除</button>
      </div>

      <input ref={pdfRef} type="file" accept="application/pdf" multiple style={{display:"none"}} onChange={handlePdf}/>
    </div>
  );
}

// ══════════════════════════════════════════
// 1問登録モーダル
// ══════════════════════════════════════════
function AddModal({books,pdfMap,setPdfMap,imgRef,aiBusy,setAiBusy,onSave,onClose,initQ}){
  const[q,setQ]=useState(initQ||{
    id:genId(),subj:SUBJS[0].s,rank:"B",
    nenNo:"",qNo:"",bookId:null,inputMode:"number",
    qText:"",sourceUrl:"",pageRange:"",memo:"",exp:"",
    missCount:1,ptns:[],hasRev:false,
    createdAt:new Date().toISOString(),
    history:[],
  });
  const s=(k,v)=>setQ(f=>({...f,[k]:v}));
  const livePats=PTNS.filter(p=>p.kw.some(kw=>(q.qText||"").includes(kw)));

  return(
    <div className="modal-bg">
      <div className="modal" style={{maxWidth:600}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:15,fontWeight:900,color:"#0f2744"}}>ミス問を登録</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#64748b"}}>✕</button>
        </div>

        {/* 使い方ガイド */}
        <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:11,color:"#1d4ed8"}}>
          💡 <strong>登録の仕方：</strong>科目・番号を入力して「保存」→ 一覧から問題を選んで ❌/✅ ボタンで解答を記録。AI解説もいつでも見られます。
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div>
            <L2>科目</L2>
            <select style={C.inp} value={q.subj} onChange={e=>s("subj",e.target.value)}>
              {SUBJS.map(sub=><option key={sub.s} value={sub.s}>{sub.s}｜{sub.f}</option>)}
            </select>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
              <div>
                <L2>年度番号</L2>
                <input style={C.inp} placeholder="例: R06-01A" value={q.nenNo} onChange={e=>s("nenNo",e.target.value)}/>
              </div>
              <div>
                <L2>問題集番号</L2>
                <input style={C.inp} placeholder="例: No.234" value={q.qNo} onChange={e=>s("qNo",e.target.value)}/>
              </div>
            </div>
            <L2>問題集を紐付け</L2>
            <select style={C.inp} value={q.bookId||""} onChange={e=>s("bookId",e.target.value||null)}>
              <option value="">— なし —</option>
              {books.map(b=><option key={b.id} value={b.id}>{b.icon||""} {b.name}</option>)}
            </select>
            <L2>難易度ランク</L2>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {RANKS.map(r=>(
                <button key={r.id} onClick={()=>s("rank",r.id)}
                  style={{padding:"2px 7px",borderRadius:10,fontSize:9,fontWeight:900,cursor:"pointer",border:`1.5px solid ${r.c}`,background:q.rank===r.id?r.c:r.bg,color:q.rank===r.id?"#fff":r.c}}>
                  {r.l}
                </button>
              ))}
            </div>
            <L2>メモ</L2>
            <textarea style={{...C.inp,height:60,resize:"vertical"}} placeholder="要点・ひっかけ・覚え方…" value={q.memo} onChange={e=>s("memo",e.target.value)}/>
          </div>
          <div>
            <L2>問題文（任意・貼り付けOK）</L2>
            <textarea style={{...C.inp,height:120,resize:"vertical"}} placeholder="問題文を貼り付けると引っかけを自動検出します" value={q.qText} onChange={e=>s("qText",e.target.value)}/>
            {livePats.length>0&&(
              <div style={{marginTop:4,padding:"5px 8px",background:"#fff7ed",borderRadius:7,border:"1px solid #fed7aa"}}>
                <div style={{fontSize:9,fontWeight:900,color:"#c2410c",marginBottom:3}}>⚠️ 引っかけ検出！</div>
                <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                  {livePats.map(p=><span key={p.id} style={{background:p.bg,color:p.c,borderRadius:5,padding:"1px 5px",fontSize:9,fontWeight:700}}><sup>{p.sym}</sup>{p.l}</span>)}
                </div>
              </div>
            )}
            <L2>URL（本試験PDF等）</L2>
            <input style={C.inp} placeholder="https://srsaitan.jp/..." value={q.sourceUrl} onChange={e=>s("sourceUrl",e.target.value)}/>
          </div>
        </div>

        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16,paddingTop:12,borderTop:"1px solid #f1f5f9"}}>
          <button onClick={onClose} style={C.btnS}>キャンセル</button>
          <button onClick={()=>onSave(q)} style={C.btnP}>💾 保存する</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// 一括ミス問入力
// ══════════════════════════════════════════
function BatchModal({books,onSave,onClose}){
  const[subj,setSubj]=useState(SUBJS[0].s);
  const[text,setText]=useState("");
  return(
    <div className="modal-bg">
      <div className="modal" style={{maxWidth:540}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:15,fontWeight:900,color:"#0f2744"}}>📦 ❌問をまとめて入力</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#64748b"}}>✕</button>
        </div>
        <div style={{background:"#eff6ff",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:11,color:"#1d4ed8"}}>
          💡 間違えた問題の番号を1行1問で入力してください。<br/>
          例：R06-01A / No.234 / 問3 など、どんな形式でもOK
        </div>
        <L2>科目</L2>
        <select style={{...C.inp,marginBottom:10}} value={subj} onChange={e=>setSubj(e.target.value)}>
          {SUBJS.map(s=><option key={s.s} value={s.s}>{s.s}｜{s.f}</option>)}
        </select>
        <L2>間違えた問題番号（1行1問）</L2>
        <textarea style={{...C.inp,height:200,resize:"vertical",marginBottom:10}}
          placeholder={"R06-01A\nR06-01B\nNo.234\n問3\n..."}
          value={text} onChange={e=>setText(e.target.value)}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={C.btnS}>キャンセル</button>
          <button onClick={()=>onSave(text.split("\n"),subj)} style={C.btnP}>
            💾 {text.split("\n").filter(l=>l.trim()).length}件を一括登録
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// 教材管理モーダル
// ══════════════════════════════════════════
function BooksModal({books,mut,onClose}){
  const[name,setName]=useState("");
  const[school,setSchool]=useState("大原");
  const[type,setType]=useState("ichi");
  const[subj,setSubj]=useState("all");
  const[editId,setEditId]=useState(null);
  const[editName,setEditName]=useState("");

  const addBook=()=>{
    if(!name.trim())return;
    const icon=MATERIAL_TYPES.find(t=>t.id===type)?.icon||"📚";
    const fullName=subj==="all"?name:`${name}（${subj}）`;
    mut(s=>({...s,books:[...s.books,{id:`b_${Date.now()}`,name:fullName,school,type,subj,icon,createdAt:toDay()}]}));
    setName("");
  };

  const grouped=MATERIAL_TYPES.map(mt=>({
    ...mt,
    schools:SCHOOLS.map(sc=>({
      school:sc,
      books:books.filter(b=>b.type===mt.id&&b.school===sc),
    })).filter(sc=>sc.books.length>0),
  })).filter(mt=>mt.schools.length>0||true);

  return(
    <div className="modal-bg">
      <div className="modal" style={{maxWidth:640}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:15,fontWeight:900,color:"#0f2744"}}>📚 教材管理</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#64748b"}}>✕</button>
        </div>

        {/* 追加フォーム */}
        <div style={{background:"#f8fafc",borderRadius:10,padding:"12px",marginBottom:14,border:"1px solid #e2e8f0"}}>
          <div style={{fontSize:11,fontWeight:900,color:"#0f2744",marginBottom:8}}>＋ 教材を追加</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div>
              <L2>種別</L2>
              <select style={C.inp} value={type} onChange={e=>setType(e.target.value)}>
                {MATERIAL_TYPES.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <L2>予備校</L2>
              <select style={C.inp} value={school} onChange={e=>setSchool(e.target.value)}>
                {SCHOOLS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div>
              <L2>科目（全科目 or 特定科目）</L2>
              <select style={C.inp} value={subj} onChange={e=>setSubj(e.target.value)}>
                <option value="all">全科目（科目横断）</option>
                {SUBJS.map(s=><option key={s.s} value={s.s}>{s.s}｜{s.f}</option>)}
              </select>
            </div>
            <div>
              <L2>教材名</L2>
              <input style={C.inp} placeholder="例: トレ問（択一）、テキスト" value={name} onChange={e=>setName(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&addBook()}/>
            </div>
          </div>
          <button onClick={addBook} style={{...C.btnP,width:"100%"}}>＋ 追加</button>
        </div>

        {/* 教材一覧 */}
        <div style={{maxHeight:360,overflowY:"auto"}}>
          {MATERIAL_TYPES.map(mt=>{
            const booksOfType=books.filter(b=>b.type===mt.id);
            if(booksOfType.length===0)return null;
            return(
              <div key={mt.id} style={{marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:900,color:"#0f2744",marginBottom:6,display:"flex",alignItems:"center",gap:4}}>
                  {mt.icon} {mt.label}
                </div>
                {SCHOOLS.map(sc=>{
                  const scBooks=booksOfType.filter(b=>b.school===sc);
                  if(scBooks.length===0)return null;
                  return(
                    <div key={sc} style={{marginBottom:8,paddingLeft:12}}>
                      <div style={{fontSize:10,color:"#64748b",fontWeight:700,marginBottom:4}}>【{sc}】</div>
                      <div style={{display:"flex",flexDirection:"column",gap:4}}>
                        {scBooks.map(b=>(
                          <div key={b.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",background:"#f8fafc",borderRadius:7,border:"1px solid #e2e8f0"}}>
                            {editId===b.id?(
                              <>
                                <input style={{...C.inp,flex:1,marginBottom:0}} value={editName} onChange={e=>setEditName(e.target.value)}/>
                                <button onClick={()=>{mut(s=>({...s,books:s.books.map(x=>x.id===b.id?{...x,name:editName}:x)}));setEditId(null);}} style={{...C.btnP,padding:"3px 10px",fontSize:10}}>✓</button>
                              </>
                            ):(
                              <>
                                <span style={{flex:1,fontSize:11}}>{b.name}{b.subj&&b.subj!=="all"&&<span style={{fontSize:9,color:"#64748b",marginLeft:4}}>({b.subj})</span>}</span>
                                <button onClick={()=>{setEditId(b.id);setEditName(b.name);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#64748b"}}>✏️</button>
                                <button onClick={()=>mut(s=>({...s,books:s.books.filter(x=>x.id!==b.id)}))} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#dc2626"}}>🗑</button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {books.length===0&&<div style={{textAlign:"center",color:"#94a3b8",padding:"20px",fontSize:12}}>教材がまだ登録されていません</div>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// 共有問題ページ
// ══════════════════════════════════════════
function SharedPage(){
  const[items,setItems]=useState([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  useEffect(()=>{SB.from("shared_questions").select("*").order("updated_at",{ascending:false}).limit(100).then(({data})=>{setItems(data||[]);setLoading(false);});},[]);
  const filtered=items.filter(i=>!search||JSON.stringify(i).toLowerCase().includes(search.toLowerCase()));
  return(
    <div style={C.panel}>
      <div style={{fontSize:14,fontWeight:900,color:"#0f2744",marginBottom:4}}>🌐 共有問題データベース</div>
      <div style={{fontSize:11,color:"#64748b",marginBottom:10}}>年度番号を登録すると問題文・AI解説が全員に共有されます。</div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 年度番号・科目で検索…" style={{...C.inp,marginBottom:10}}/>
      {loading?<div style={{textAlign:"center",padding:"20px",color:"#94a3b8"}}>読み込み中…</div>:(
        filtered.length===0?<div style={{textAlign:"center",padding:"20px",color:"#94a3b8"}}>まだ共有データはありません</div>
        :<div style={{display:"flex",flexDirection:"column",gap:7}}>
          {filtered.map(item=>{
            const subj=SUBJS.find(s=>s.f===item.subject);
            return(
              <div key={item.id} style={{background:"#f8fafc",borderRadius:8,padding:"9px 11px",border:"1px solid #e2e8f0"}}>
                <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:3}}>
                  {subj&&<span style={{fontSize:9,background:"#0f2744",color:"#fff",borderRadius:4,padding:"1px 6px",fontWeight:700}}>{subj.s}</span>}
                  <span style={{fontSize:11,fontWeight:900,color:"#0369a1"}}>{item.nendo_no}</span>
                  {item.has_rev&&<span style={{fontSize:9,background:"#f3e8ff",color:"#7c3aed",borderRadius:4,padding:"1px 5px",fontWeight:700}}>🆕</span>}
                  <span style={{fontSize:9,color:"#94a3b8",marginLeft:"auto"}}>{item.updated_at?.slice(0,10)}</span>
                </div>
                {item.question_text&&<div style={{fontSize:11,color:"#1e293b",lineHeight:1.7}}>{item.question_text.slice(0,100)}{item.question_text.length>100?"…":""}</div>}
                {item.explanation&&<div style={{fontSize:10,color:"#0369a1",marginTop:2}}>✨ AI解説あり</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// 更新手順モーダル
// ══════════════════════════════════════════
function UpdateModal({onClose}){
  const steps=[
    {n:"①",t:"VSCodeでApp.jsxを開く",d:"src/App.jsx を開いて Ctrl+A → Delete → 新しいコードをCtrl+V → Ctrl+S"},
    {n:"②",t:"動作確認",d:"PowerShell: npm run dev → http://localhost:5173/sharoushi-mismon/ で確認"},
    {n:"③",t:"GitHubに公開",d:"git add .\ngit commit -m \"更新内容\"\ngit push origin main\nnpm run deploy"},
    {n:"④",t:"公開URLで確認",d:"https://jakutenmondai.github.io/sharoushi-mismon/"},
  ];
  return(
    <div className="modal-bg">
      <div className="modal" style={{maxWidth:500}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:15,fontWeight:900,color:"#0f2744"}}>📋 アプリ更新手順</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#64748b"}}>✕</button>
        </div>
        {steps.map(s=>(
          <div key={s.n} style={{display:"flex",gap:10,marginBottom:14,padding:"10px 12px",background:"#f8fafc",borderRadius:9,border:"1px solid #e2e8f0"}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:"#0f2744",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,flexShrink:0}}>{s.n}</div>
            <div>
              <div style={{fontSize:12,fontWeight:900,color:"#0f2744",marginBottom:4}}>{s.t}</div>
              <pre style={{fontSize:11,color:"#475569",whiteSpace:"pre-wrap",fontFamily:"monospace",background:"#fff",padding:"6px 8px",borderRadius:6,border:"1px solid #e2e8f0"}}>{s.d}</pre>
            </div>
          </div>
        ))}
        <div style={{fontSize:10,color:"#64748b",background:"#eff6ff",borderRadius:8,padding:"8px 10px"}}>
          💡 <strong>覚え方：</strong>開発中は「npm run dev」、公開は「npm run deploy」
        </div>
      </div>
    </div>
  );
}

// ── ユーティリティ ──
function L2({children}){return<div style={{fontSize:10,color:"#64748b",fontWeight:700,marginBottom:3,marginTop:7}}>{children}</div>;}

const C={
  panel:{background:"#fff",borderRadius:13,padding:14,boxShadow:"0 2px 8px rgba(0,0,0,.07)"},
  card:{background:"#fff",borderRadius:12,padding:13,boxShadow:"0 2px 8px rgba(0,0,0,.07)"},
  cardT:{fontSize:12,fontWeight:900,color:"#0f2744",marginBottom:10,paddingBottom:5,borderBottom:"1px solid #f1f5f9"},
  inp:{width:"100%",padding:"7px 10px",border:"1.5px solid #e2e8f0",borderRadius:7,fontSize:12,color:"#1e293b",background:"#f8fafc",boxSizing:"border-box",fontFamily:"inherit"},
  sel:{padding:"6px 8px",border:"1.5px solid #e2e8f0",borderRadius:7,fontSize:11,background:"#fff",color:"#1e293b",flex:1,minWidth:70},
  btnP:{background:"#0f2744",color:"#fff",border:"none",borderRadius:7,padding:"8px 18px",fontSize:12,fontWeight:700,cursor:"pointer"},
  btnS:{background:"#f1f5f9",color:"#475569",border:"none",borderRadius:7,padding:"8px 18px",fontSize:12,fontWeight:700,cursor:"pointer"},
};