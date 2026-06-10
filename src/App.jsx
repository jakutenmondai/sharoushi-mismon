import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ── Supabase（キーを直接埋め込み・Publishableキーなので安全）──
const SB_URL = "https://sxnniucinmctlaqvkbkc.supabase.co";
const SB_KEY = "sb_publishable_D5QFilgFhf7nn0_wcD9ExA_D2NRzHQw";
const sb = createClient(SB_URL, SB_KEY);

// ── 試験日（8月第4日曜） ──
function getExamDate(y) {
  let n = 0;
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(y, 7, d);
    if (dt.getMonth() !== 7) break;
    if (dt.getDay() === 0 && ++n === 4) return dt;
  }
  return new Date(y, 7, 25);
}
function calcDays() {
  const now = new Date();
  let exam = getExamDate(now.getFullYear());
  if (now > exam) exam = getExamDate(now.getFullYear() + 1);
  return { days: Math.max(0, Math.floor((exam - now) / 86400000)), exam };
}
function fmtDate(d) { return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（日）`; }
function toDay() { return new Date().toISOString().slice(0, 10); }

// ── 科目（略称のみ使用） ──
const SUBJS = [
  { full:"労働基準法",                          short:"労基" },
  { full:"労働安全衛生法",                      short:"安衛" },
  { full:"労働者災害補償保険法",                short:"労災" },
  { full:"雇用保険法",                          short:"雇用" },
  { full:"労働保険の保険料の徴収等に関する法律", short:"徴収" },
  { full:"健康保険法",                          short:"健保" },
  { full:"厚生年金保険法",                      short:"厚年" },
  { full:"国民年金法",                          short:"国年" },
  { full:"労務管理その他の労働に関する一般常識", short:"労一" },
  { full:"社会保険に関する一般常識",            short:"社一" },
];

// ── 問題集・教材の種別 ──
const BOOK_TYPES = [
  { id:"text",    icon:"📖", label:"テキスト・参考書・法改正教材", color:"#0369a1", bg:"#e0f2fe",
    hint:"テキスト本文・南備考・法改正教材。PDF参照でどの章・節かを特定するのに使います。" },
  { id:"ichi",    icon:"📝", label:"一問一答問題集",                color:"#16a34a", bg:"#dcfce7",
    hint:"大原・山予備・LECなどの一問一答。問題集番号（No.234）と年度番号（R06-01A）を紐付けて管理。" },
  { id:"nendo",   icon:"🏛", label:"年度別本試験過去問",            color:"#7c3aed", bg:"#f3e8ff",
    hint:"第1回〜第57回の本試験問題。srsaitan.jpのPDFまたはURLで参照できます。" },
  { id:"moshi",   icon:"📋", label:"模試・答練・直前対策",          color:"#dc2626", bg:"#fee2e2",
    hint:"各予備校の模試・答練・直前対策教材。" },
  { id:"orig",    icon:"🏫", label:"予備校オリジナル問題",          color:"#f59e0b", bg:"#fef3c7",
    hint:"各予備校独自の練習問題・オリジナル教材。" },
];

// ── ランク ──
const RANKS = [
  { id:"G", label:"G やさしい", color:"#22c55e", bg:"#dcfce7" },
  { id:"A", label:"A 基礎",     color:"#3b82f6", bg:"#dbeafe" },
  { id:"B", label:"B 普通",     color:"#6366f1", bg:"#e0e7ff" },
  { id:"C", label:"C やや難",   color:"#f59e0b", bg:"#fef3c7" },
  { id:"D", label:"D 難しい",   color:"#f97316", bg:"#ffedd5" },
  { id:"E", label:"E 激ムズ",   color:"#ef4444", bg:"#fee2e2" },
  { id:"F", label:"F 落とし穴", color:"#7c3aed", bg:"#f3e8ff" },
];

// ── 引っかけパターン ──
const PTNS = [
  { id:"abs", c:"#ef4444", bg:"#fee2e2", lbl:"断定表現",     sym:"◎", kw:["必ず","常に","絶対に","いかなる場合","例外なく","一律に","すべての"],    tip:"例外の有無を確認" },
  { id:"bnd", c:"#f59e0b", bg:"#fef3c7", lbl:"境界線",       sym:"△", kw:["以上","以下","超える","未満","を超え","に満たない"],                       tip:"含む/含まないを確認" },
  { id:"neg", c:"#8b5cf6", bg:"#ede9fe", lbl:"肯定/否定逆転", sym:"→", kw:["できる","できない","しなければならない","してはならない","要しない"],       tip:"文末まで読んで判断" },
  { id:"sbj", c:"#3b82f6", bg:"#dbeafe", lbl:"主語すり替え", sym:"□", kw:["労働者","使用者","事業主","厚生労働大臣","都道府県知事","被保険者","受給資格者"], tip:"主語を丸で囲む" },
  { id:"lim", c:"#ec4899", bg:"#fce7f3", lbl:"限定表現",     sym:"★", kw:["のみ","だけ","に限り"],                                                  tip:"本当にそれだけ？" },
  { id:"prc", c:"#0ea5e9", bg:"#e0f2fe", lbl:"行政手続",     sym:"⬡", kw:["届出","許可","認可","申請","承認"],                                       tip:"届出vs許可の違い" },
  { id:"exc", c:"#10b981", bg:"#d1fae5", lbl:"原則/例外",    sym:"⬡", kw:["原則として","ただし","特別の定め","を除き","この限りでない"],               tip:"原則の消去に注意" },
  { id:"and", c:"#f97316", bg:"#ffedd5", lbl:"OR/AND",       sym:"◇", kw:["または","かつ","及び","若しくは"],                                         tip:"OR=どちらかOK, AND=両方必要" },
];
const REV_KW = ["法改正","改正","令和","R5","R6","R7","2024年","2025年","拡大","引き上げ","新設","産後パパ育休","週10時間","月60時間"];

function detectPtns(text) { return PTNS.filter(p=>p.kw.some(kw=>(text||"").includes(kw))).map(p=>p.id); }
function detectRev(text) { return REV_KW.some(kw=>(text||"").includes(kw)); }
function extractRank(text) { const m=(text||"").match(/RANK:([GABCDEF])/); return m?m[1]:"B"; }

// ── ハイライト ──
function HL({ text }) {
  if (!text) return null;
  const marks = [];
  PTNS.forEach(p=>p.kw.forEach(kw=>{
    let i=0;
    while((i=text.indexOf(kw,i))!==-1){ marks.push({s:i,e:i+kw.length,c:p.c,bg:p.bg,sym:p.sym,lbl:p.lbl,tip:p.tip}); i+=kw.length; }
  }));
  REV_KW.forEach(kw=>{
    let i=0;
    while((i=text.indexOf(kw,i))!==-1){ marks.push({s:i,e:i+kw.length,c:"#7c3aed",bg:"#f3e8ff",sym:"🆕",lbl:"法改正",tip:"施行状況を確認"}); i+=kw.length; }
  });
  if(!marks.length) return <>{text}</>;
  marks.sort((a,b)=>a.s-b.s||b.e-a.e);
  const merged=[]; let cur=null;
  for(const m of marks){ if(!cur){cur={...m};continue;} if(m.s<cur.e)continue; merged.push(cur);cur={...m}; }
  if(cur) merged.push(cur);
  const out=[]; let pos=0;
  merged.forEach((m,i)=>{
    if(pos<m.s) out.push(<span key={"t"+i}>{text.slice(pos,m.s)}</span>);
    out.push(<span key={"m"+i} title={`【${m.lbl}】${m.tip}`} style={{background:m.bg,color:m.c,fontWeight:900,borderRadius:3,padding:"0 2px",border:`1.5px solid ${m.c}55`,cursor:"help"}}><sup style={{fontSize:8}}>{m.sym}</sup>{text.slice(m.s,m.e)}</span>);
    pos=m.e;
  });
  if(pos<text.length) out.push(<span key="last">{text.slice(pos)}</span>);
  return <>{out}</>;
}

// ── Storage ──
const SK="sharoushi_v7";
function loadLocal(){ try{return JSON.parse(localStorage.getItem(SK)||"null")||{qs:[],books:[],userId:null};}catch{return{qs:[],books:[],userId:null};} }
function saveLocal(st){ localStorage.setItem(SK,JSON.stringify(st)); }
function genId(){ return "u_"+Math.random().toString(36).slice(2,10); }

// ── AI ──
const AI_SYS=`あなたは社会保険労務士試験の最上位専門家です。
・引っかけパターン名と問題文中の該当箇所・印のつけ方（◎△→□★⬡◇）
・テキストのどの章・節を重点的に読むべきか
・法改正がある場合は【🆕法改正】と明記し試験当日の施行状況を記載
・過去57回の出題実績
・最後に必ず「RANK:X」（X=G/A/B/C/D/E/Fのいずれか）を記載

## 🎯 問われているテーマ
## ⚠️ 引っかけパターンと印のつけ方
## ✅ 正解と根拠（条文・通達・判例）
## 📖 詳細解説（数字・期間・要件・例外を網羅）
## 📊 過去57回の出題実績
## 🆕 法改正ポイント
## 📌 テキスト該当箇所・重点的に読むべき章節
## 💡 試験対策メモ
RANK:X`;

async function callAI(messages){
  const r=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:AI_SYS,messages}),
  });
  const d=await r.json();
  if(d.error) throw new Error(d.error.message);
  return d.content?.map(b=>b.text||"").join("")||"";
}

async function aiExplain(form,books,pdfMap){
  const subj=SUBJS.find(s=>s.full===form.subject||s.short===form.subject);
  const subjLabel=subj?`${subj.short}（${subj.full}）`:form.subject;
  const book=books.find(b=>b.id===form.bookId);
  const pdfKey=form.bookId||"__tmp";
  const pdfs=Object.entries(pdfMap).filter(([k])=>k===pdfKey||k===form.bookId);

  if(form.inputMode==="pdf"&&pdfs.length>0){
    const [,pdfData]=pdfs[0];
    const pageHint=form.pageRange?`${form.pageRange}ページを解説`:`問題番号「${form.nendoNo||form.qNo}」を見つけて問題文も引用して解説`;
    return callAI([{role:"user",content:[
      {type:"document",source:{type:"base64",media_type:"application/pdf",data:pdfData.b64}},
      {type:"text",text:`このPDFは「${book?.name||"問題集"}」。科目:${subjLabel}\n${pageHint}。`},
    ]}]);
  }
  if(form.inputMode==="text"&&form.questionText){
    return callAI([{role:"user",content:`【科目】${subjLabel}\n【年度番号】${form.nendoNo||"未入力"}\n【問題文】\n${form.questionText}`}]);
  }
  if(form.inputMode==="url"&&form.sourceUrl){
    return callAI([{role:"user",content:`【科目】${subjLabel}\n【URL】${form.sourceUrl}\n【問題番号】${form.nendoNo||form.qNo||"未入力"}\n上記の問題を解説してください。`}]);
  }
  // 番号指定（デフォルト）
  return callAI([{role:"user",content:`【科目】${subjLabel}\n【年度番号】${form.nendoNo||"未入力"}\n【問題集番号】${form.qNo||"未入力"}\n${book?`【問題集】${book.name}`:""}`}]);
}

async function aiImage(b64,mime,subject){
  const subj=SUBJS.find(s=>s.full===subject||s.short===subject);
  return callAI([{role:"user",content:[
    {type:"image",source:{type:"base64",media_type:mime,data:b64}},
    {type:"text",text:`この社労士試験問題を全問まとめて解説。科目:${subj?.short||subject}`},
  ]}]);
}

async function aiBatch(text){
  return callAI([{role:"user",content:`以下の社労士試験問題をまとめて解説してください。各問を【問題N】で区切り解説。\n\n${text}`}]);
}

// ── Supabase ──
async function sbUpsert(q){
  try{
    await sb.from("shared_questions").upsert({
      id:q.nendoNo||`local_${q.id}`,
      subject:q.subject,
      nendo_no:q.nendoNo||null,
      question_text:q.questionText||null,
      explanation:q.explanation||null,
      ptns:q.ptns||[],
      has_rev:q.hasRev||false,
      updated_at:new Date().toISOString(),
    });
  }catch(e){console.error("Supabase error:",e);}
}

async function sbFetch(nendoNo){
  if(!nendoNo) return null;
  try{
    const{data}=await sb.from("shared_questions").select("*").eq("nendo_no",nendoNo).single();
    return data||null;
  }catch{return null;}
}

async function sbFetchAll(){
  try{
    const{data}=await sb.from("shared_questions").select("*").order("updated_at",{ascending:false}).limit(100);
    return data||[];
  }catch{return[];}
}

// ── APP ──
export default function App(){
  const[st,setSt]=useState(loadLocal);
  const[page,setPage]=useState("dash");
  const[cd,setCd]=useState(calcDays);
  const[form,setForm]=useState(null);
  const[detId,setDetId]=useState(null);
  const[aiBusy,setAiBusy]=useState(false);
  const[aiOut,setAiOut]=useState("");
  const[aiErr,setAiErr]=useState("");
  const[pdfMap,setPdfMap]=useState({});
  const[filter,setFilter]=useState({subj:"all",rank:"all",ptn:"all",q:""});
  const[batchText,setBatchText]=useState("");
  const[batchResult,setBatchResult]=useState("");
  const[sbMsg,setSbMsg]=useState("");
  const imgRef=useRef();
  const importRef=useRef();

  useEffect(()=>{
    if(!st.userId) mut(s=>({...s,userId:genId()}));
  },[]);
  useEffect(()=>{
    const id=setInterval(()=>setCd(calcDays()),60000);
    return()=>clearInterval(id);
  },[]);

  const mut=useCallback(fn=>setSt(prev=>{const next=fn(prev);saveLocal(next);return next;}),[]);

  const saveQ=async q=>{
    const ptns=detectPtns((q.questionText||"")+(q.explanation||""));
    const hasRev=detectRev(q.explanation||"");
    const rank=q.explanation?(extractRank(q.explanation)||q.rank||"B"):(q.rank||"B");
    const final={...q,ptns,hasRev,rank};
    mut(s=>{
      const idx=s.qs.findIndex(x=>x.id===q.id);
      return{...s,qs:idx>=0?s.qs.map((x,i)=>i===idx?final:x):[final,...s.qs]};
    });
    if(final.nendoNo&&(final.questionText||final.explanation)){
      await sbUpsert(final);
      setSbMsg("共有DB同期済み✓");
      setTimeout(()=>setSbMsg(""),3000);
    }
    setPage("list");setForm(null);setAiOut("");setAiErr("");
  };

  const deleteQ=id=>{
    if(!confirm("削除しますか？"))return;
    mut(s=>({...s,qs:s.qs.filter(q=>q.id!==id)}));
    setDetId(null);setPage("list");
  };

  const record=(id,r)=>mut(s=>({
    ...s,qs:s.qs.map(q=>q.id!==id?q:{
      ...q,
      missCount:r==="×"?q.missCount+1:q.missCount,
      history:[...(q.history||[]),{date:toDay(),r}],
    })
  }));

  const newForm=()=>setForm({
    id:Date.now(),_new:true,
    subject:SUBJS[0].full,rank:"B",
    nendoNo:"",qNo:"",
    bookId:null,
    inputMode:"number",
    questionText:"",sourceUrl:"",pageRange:"",
    missCount:1,memo:"",explanation:"",
    ptns:[],hasRev:false,
    createdAt:new Date().toISOString(),
    history:[],  // ← 登録時は空。解いたときだけ記録
  });

  const runAI=async()=>{
    if(!form)return;
    setAiBusy(true);setAiErr("");setAiOut("");
    try{
      // 共有DBに同じ年度番号があれば取得
      if(form.nendoNo){
        const shared=await sbFetch(form.nendoNo);
        if(shared?.explanation){
          setAiOut(shared.explanation);
          setForm(f=>({...f,explanation:shared.explanation,questionText:shared.question_text||f.questionText}));
          setSbMsg("共有DBから取得✓");
          setTimeout(()=>setSbMsg(""),3000);
          setAiBusy(false);return;
        }
      }
      const result=await aiExplain(form,st.books,pdfMap);
      if(result){setAiOut(result);setForm(f=>({...f,explanation:result}));}
    }catch(e){setAiErr("エラー: "+e.message);}
    setAiBusy(false);
  };

  const runAIImage=async file=>{
    setAiBusy(true);setAiErr("");setAiOut("");
    const reader=new FileReader();
    reader.onload=async ev=>{
      try{
        const b64=ev.target.result.split(",")[1];
        const result=await aiImage(b64,file.type,form?.subject||SUBJS[0].full);
        setAiOut(result);setForm(f=>f?({...f,explanation:result}):f);
      }catch(e){setAiErr("エラー: "+e.message);}
      setAiBusy(false);
    };
    reader.readAsDataURL(file);
  };

  const runBatch=async()=>{
    if(!batchText.trim())return;
    setAiBusy(true);setBatchResult("");
    try{const r=await aiBatch(batchText);setBatchResult(r);}
    catch(e){setBatchResult("エラー: "+e.message);}
    setAiBusy(false);
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
        if(!confirm(`${(d.qs||[]).length}件をインポートします（現データに追加）`))return;
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
    .filter(q=>filter.subj==="all"||q.subject===filter.subj)
    .filter(q=>filter.rank==="all"||q.rank===filter.rank)
    .filter(q=>filter.ptn==="all"||(q.ptns||[]).includes(filter.ptn))
    .filter(q=>!filter.q||JSON.stringify(q).toLowerCase().includes(filter.q.toLowerCase()))
    .sort((a,b)=>b.missCount-a.missCount);

  const detQ=st.qs.find(q=>q.id===detId);

  return(
    <div style={{fontFamily:"'Hiragino Sans','Yu Gothic',sans-serif",minHeight:"100vh",background:"#f1f5f9",color:"#1e293b"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        .card{transition:.15s;} .card:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,0,0,.1);}
        @keyframes pr{0%{width:0}80%{width:90%}100%{width:96%}}
        .pr{animation:pr 3s ease-out forwards;height:100%;background:#0f2744;border-radius:3px;}
        select,input,textarea{outline:none;font-family:inherit;}
        select:focus,input:focus,textarea:focus{border-color:#3b82f6!important;}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:2px;}
      `}</style>

      {/* HEADER */}
      <div style={{background:"linear-gradient(135deg,#0f2744,#1a3a72)",padding:"12px 16px"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:42,height:42,borderRadius:10,background:"#f59e0b",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:900,color:"#fff"}}>社</div>
            <div>
              <div style={{fontSize:16,fontWeight:900,color:"#fff"}}>ミス問ノート</div>
              <div style={{fontSize:9,color:"#93c5fd"}}>社労士試験・弱点克服トラッカー</div>
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,.1)",borderRadius:10,padding:"8px 16px",textAlign:"center"}}>
            <div style={{fontSize:9,color:"#93c5fd",marginBottom:2}}>本試験まで</div>
            <div style={{fontSize:9,color:"#e0f2fe",marginBottom:2}}>{fmtDate(cd.exam)}</div>
            <div style={{fontSize:26,fontWeight:900,color:"#f59e0b",lineHeight:1}}>{cd.days}<span style={{fontSize:12,color:"#fde68a",marginLeft:2}}>日</span></div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",gap:14,flexWrap:"wrap",alignItems:"center"}}>
            {[["登録",st.qs.length,"#fff"],["総ミス",st.qs.reduce((s,q)=>s+q.missCount,0),"#fca5a5"],["要注意",st.qs.filter(q=>q.missCount>=5).length,"#fde68a"],["🆕改正",st.qs.filter(q=>q.hasRev).length,"#c4b5fd"]].map(([l,n,c])=>(
              <div key={l} style={{textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:900,color:c,lineHeight:1}}>{n}</div>
                <div style={{fontSize:8,color:"#bfdbfe"}}>{l}</div>
              </div>
            ))}
            {sbMsg&&<div style={{fontSize:9,color:"#86efac"}}>{sbMsg}</div>}
          </div>
        </div>
      </div>

      {/* NAV */}
      <div style={{background:"#fff",borderBottom:"2px solid #e2e8f0",overflowX:"auto"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex"}}>
          {[["dash","🏠 ダッシュボード"],["list","📋 一覧"],["add","➕ 登録"],["batch","📦 まとめ解説"],["shared","🌐 共有問題"]].map(([t,l])=>(
            <button key={t} onClick={()=>{ if(t==="add"){newForm();setAiOut("");setAiErr("");} setPage(t); }}
              style={{padding:"10px 14px",border:"none",background:"none",cursor:"pointer",fontSize:12,fontWeight:700,color:page===t?"#0f2744":"#64748b",borderBottom:page===t?"3px solid #0f2744":"3px solid transparent",whiteSpace:"nowrap"}}>
              {l}
            </button>
          ))}
          <div style={{marginLeft:"auto",display:"flex"}}>
            <button onClick={exportData} style={{padding:"10px 12px",border:"none",background:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:"#64748b"}}>📤 出力</button>
            <button onClick={()=>importRef.current?.click()} style={{padding:"10px 12px",border:"none",background:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:"#64748b"}}>📥 入力</button>
            <input ref={importRef} type="file" accept=".json" style={{display:"none"}} onChange={importData}/>
          </div>
        </div>
      </div>

      {/* 凡例 */}
      <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"4px 14px",overflowX:"auto"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:9,color:"#64748b",fontWeight:700,flexShrink:0}}>印：</span>
          {PTNS.map(p=>(
            <span key={p.id} title={p.tip} style={{fontSize:9,background:p.bg,color:p.c,border:`1px solid ${p.c}44`,borderRadius:10,padding:"1px 7px",fontWeight:700,cursor:"help"}}>
              <sup>{p.sym}</sup>{p.lbl}
            </span>
          ))}
          <span style={{fontSize:9,background:"#f3e8ff",color:"#7c3aed",borderRadius:10,padding:"1px 7px",fontWeight:700}}>🆕法改正</span>
        </div>
      </div>

      {/* PAGES */}
      <div style={{maxWidth:1200,margin:"0 auto",padding:"14px 12px"}}>
        {page==="dash"&&<DashPage qs={st.qs} cd={cd} onAdd={()=>{newForm();setPage("add");}}/>}
        {page==="list"&&(
          <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
            <div style={{flex:detQ?"0 0 360px":"1 1 100%",maxWidth:detQ?400:"100%"}}>
              <ListPage qs={visQs} filter={filter} setFilter={setFilter} selectedId={detId} onSelect={q=>setDetId(q.id)} onAdd={()=>{newForm();setPage("add");}}/>
            </div>
            {detQ&&(
              <div style={{flex:"1 1 0",minWidth:0}}>
                <DetPage q={detQ} books={st.books}
                  onEdit={()=>{setForm(detQ);setAiOut(detQ.explanation||"");setAiErr("");setPage("add");}}
                  onDelete={()=>deleteQ(detQ.id)}
                  onRecord={r=>record(detQ.id,r)}
                  onClose={()=>setDetId(null)}/>
              </div>
            )}
          </div>
        )}
        {page==="add"&&form&&(
          <AddPage form={form} setForm={setForm} books={st.books}
            aiBusy={aiBusy} aiOut={aiOut} aiErr={aiErr}
            pdfMap={pdfMap} setPdfMap={setPdfMap} imgRef={imgRef}
            onRunAI={runAI}
            onSave={()=>saveQ(form)}
            onCancel={()=>{setPage("list");setForm(null);}}
            onAddBook={b=>mut(s=>({...s,books:[...s.books,b]}))}
            onDeleteBook={id=>mut(s=>({...s,books:s.books.filter(b=>b.id!==id)}))}/>
        )}
        {page==="batch"&&<BatchPage aiBusy={aiBusy} batchText={batchText} setBatchText={setBatchText} batchResult={batchResult} onRun={runBatch} imgRef={imgRef}/>}
        {page==="shared"&&<SharedPage fetchAll={sbFetchAll}/>}
      </div>

      <input ref={imgRef} type="file" accept="image/*" style={{display:"none"}}
        onChange={e=>{const f=e.target.files?.[0];if(f)runAIImage(f);e.target.value="";}}/>
    </div>
  );
}

// ── DASHBOARD ──
function DashPage({qs,cd,onAdd}){
  const miss5=qs.filter(q=>q.missCount>=5);
  const week=qs.filter(q=>{ const l=q.history?.slice(-1)[0]; return l?.r==="×"&&new Date()-new Date(l.date)<7*864e5; }).sort((a,b)=>b.missCount-a.missCount).slice(0,6);
  const rankCnt=RANKS.map(r=>({...r,n:qs.filter(q=>q.rank===r.id).length}));
  const ptnCnt=PTNS.map(p=>({...p,n:qs.filter(q=>(q.ptns||[]).includes(p.id)).length})).filter(p=>p.n>0);
  return(
    <div>
      <div style={{background:"linear-gradient(135deg,#0f2744,#1a3a72)",borderRadius:14,padding:"16px 20px",marginBottom:14,display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:10,color:"#93c5fd",marginBottom:2}}>社会保険労務士試験 本試験</div>
          <div style={{fontSize:18,fontWeight:900,color:"#fff",marginBottom:4}}>{fmtDate(cd.exam)}</div>
          <div style={{fontSize:13,color:"#fde68a",fontWeight:700}}>あと <span style={{fontSize:26}}>{cd.days}</span> 日！</div>
        </div>
        <div style={{display:"flex",gap:12}}>
          {[["登録",qs.length,"#fff"],["🔴 要注意5+",miss5.length,"#fca5a5"],["🟡 注意3-4",qs.filter(q=>q.missCount>=3&&q.missCount<5).length,"#fde68a"],["🆕 法改正",qs.filter(q=>q.hasRev).length,"#c4b5fd"]].map(([l,n,c])=>(
            <div key={l} style={{textAlign:"center"}}>
              <div style={{fontSize:22,fontWeight:900,color:c,lineHeight:1}}>{n}</div>
              <div style={{fontSize:8,color:"#93c5fd",marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div style={C.card}>
          <div style={C.cardT}>🔴 要注意問題 TOP（ミス5回以上）</div>
          {miss5.length===0?<div style={{color:"#94a3b8",fontSize:12,textAlign:"center",padding:"16px 0"}}>まだ要注意問題はありません👍</div>
            :miss5.sort((a,b)=>b.missCount-a.missCount).slice(0,5).map(q=><QMini key={q.id} q={q}/>)}
          <button onClick={onAdd} style={{...C.btnP,width:"100%",marginTop:10}}>➕ 新規登録</button>
        </div>
        <div style={C.card}>
          <div style={C.cardT}>📅 直近7日のミス</div>
          {week.length===0?<div style={{color:"#94a3b8",fontSize:12,textAlign:"center",padding:"16px 0"}}>直近7日のミスはありません</div>
            :week.map(q=><QMini key={q.id} q={q}/>)}
        </div>
        <div style={C.card}>
          <div style={C.cardT}>⭐ ランク別登録数</div>
          {rankCnt.map(r=>(
            <div key={r.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <span style={{fontSize:10,fontWeight:900,color:r.color,background:r.bg,borderRadius:5,padding:"2px 8px",width:80,textAlign:"center"}}>{r.label}</span>
              <div style={{flex:1,background:"#f1f5f9",borderRadius:3,height:8,overflow:"hidden"}}>
                <div style={{height:"100%",background:r.color,width:`${qs.length?(r.n/qs.length*100):0}%`,borderRadius:3}}/>
              </div>
              <span style={{fontSize:11,fontWeight:700,color:r.color,width:24,textAlign:"right"}}>{r.n}</span>
            </div>
          ))}
        </div>
        <div style={C.card}>
          <div style={C.cardT}>⚠️ 引っかけパターン別</div>
          {ptnCnt.length===0?<div style={{color:"#94a3b8",fontSize:12}}>問題を登録するとパターンが表示されます</div>
            :ptnCnt.sort((a,b)=>b.n-a.n).map(p=>(
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                <span style={{fontSize:9,fontWeight:900,color:p.c,background:p.bg,borderRadius:5,padding:"1px 6px",width:90,textAlign:"center"}}><sup>{p.sym}</sup>{p.lbl}</span>
                <div style={{flex:1,background:"#f1f5f9",borderRadius:3,height:7,overflow:"hidden"}}>
                  <div style={{height:"100%",background:p.c,width:`${qs.length?(p.n/qs.length*100):0}%`,borderRadius:3}}/>
                </div>
                <span style={{fontSize:10,fontWeight:700,color:p.c,width:22,textAlign:"right"}}>{p.n}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
function QMini({q}){
  const rk=RANKS.find(r=>r.id===q.rank)||RANKS[1];
  const subj=SUBJS.find(s=>s.full===q.subject);
  const last=q.history?.slice(-1)[0];
  return(
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,padding:"5px 8px",background:"#fef2f2",borderRadius:7,border:"1px solid #fca5a5"}}>
      <span style={{fontSize:9,background:rk.bg,color:rk.color,borderRadius:4,padding:"1px 5px",fontWeight:900,flexShrink:0}}>{rk.id}</span>
      <span style={{fontSize:9,background:"#e0f2fe",color:"#0369a1",borderRadius:4,padding:"1px 5px",fontWeight:700,flexShrink:0}}>{subj?.short||q.subject?.slice(0,2)}</span>
      <span style={{fontSize:10,fontWeight:700,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{q.nendoNo||q.qNo||"?"}</span>
      <span style={{fontSize:10,background:"#ef4444",color:"#fff",borderRadius:10,padding:"1px 6px",fontWeight:900,flexShrink:0}}>×{q.missCount}</span>
      {last&&<span style={{fontSize:9,color:"#94a3b8",flexShrink:0}}>{last.date}</span>}
    </div>
  );
}

// ── LIST PAGE ──
function ListPage({qs,filter,setFilter,selectedId,onSelect,onAdd}){
  const sf=v=>setFilter(f=>({...f,...v}));
  return(
    <div style={C.panel}>
      <input value={filter.q} onChange={e=>sf({q:e.target.value})} placeholder="🔍 年度番号・科目・メモ検索…" style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e2e8f0",borderRadius:9,fontSize:13,marginBottom:8,background:"#f8fafc"}}/>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
        <select value={filter.subj} onChange={e=>sf({subj:e.target.value})} style={C.sel}>
          <option value="all">全科目</option>
          {SUBJS.map(s=><option key={s.full} value={s.full}>{s.short}</option>)}
        </select>
        <select value={filter.rank} onChange={e=>sf({rank:e.target.value})} style={C.sel}>
          <option value="all">全ランク</option>
          {RANKS.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <select value={filter.ptn} onChange={e=>sf({ptn:e.target.value})} style={C.sel}>
          <option value="all">全パターン</option>
          {PTNS.map(p=><option key={p.id} value={p.id}>{p.lbl}</option>)}
        </select>
      </div>
      <div style={{fontSize:10,color:"#94a3b8",marginBottom:7}}>{qs.length}件</div>
      {qs.length===0?(
        <div style={{textAlign:"center",padding:"32px 0",color:"#94a3b8"}}>
          <div style={{fontSize:36,marginBottom:8}}>📝</div>
          <button onClick={onAdd} style={C.btnP}>最初の問題を登録</button>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:"70vh",overflowY:"auto"}}>
          {qs.map(q=><QCard key={q.id} q={q} selected={q.id===selectedId} onClick={()=>onSelect(q)}/>)}
        </div>
      )}
    </div>
  );
}
function QCard({q,selected,onClick}){
  const acc=q.missCount>=5?"#ef4444":q.missCount>=3?"#f59e0b":"#22c55e";
  const bg=selected?"#eff6ff":q.missCount>=5?"#fef2f2":q.missCount>=3?"#fffbeb":"#fff";
  const rk=RANKS.find(r=>r.id===q.rank)||RANKS[1];
  const pats=(q.ptns||[]).map(id=>PTNS.find(p=>p.id===id)).filter(Boolean);
  const hist=q.history||[];
  const cor=hist.filter(h=>h.r==="○").length;
  const rate=hist.length?Math.round(cor/hist.length*100):null;
  const last=hist.slice(-1)[0];
  const subj=SUBJS.find(s=>s.full===q.subject);
  return(
    <div className="card" onClick={onClick} style={{borderRadius:9,padding:"10px 12px",cursor:"pointer",background:bg,borderLeft:`4px solid ${acc}`,outline:selected?"2px solid #3b82f6":"none",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
        <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:8,background:"#0f2744",color:"#fff",borderRadius:4,padding:"1px 5px",fontWeight:700}}>{subj?.short}</span>
          <span style={{fontSize:8,background:rk.bg,color:rk.color,borderRadius:4,padding:"1px 5px",fontWeight:900}}>{rk.id}</span>
          {q.hasRev&&<span style={{fontSize:8,background:"#f3e8ff",color:"#7c3aed",borderRadius:4,padding:"1px 4px",fontWeight:700}}>🆕</span>}
        </div>
        <span style={{fontSize:10,background:acc,color:"#fff",borderRadius:20,padding:"1px 7px",fontWeight:900}}>×{q.missCount}</span>
      </div>
      <div style={{fontSize:11,fontWeight:700,marginBottom:2}}>
        {q.nendoNo&&<span style={{background:"#e0f2fe",color:"#0369a1",borderRadius:4,padding:"1px 6px",marginRight:4,fontSize:10}}>{q.nendoNo}</span>}
        {q.qNo&&<span style={{color:"#64748b",fontSize:10}}>No.{q.qNo}</span>}
      </div>
      {pats.length>0&&(
        <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:3}}>
          {pats.map(p=><span key={p.id} style={{fontSize:8,background:p.bg,color:p.c,borderRadius:5,padding:"0 5px",fontWeight:700}}><sup>{p.sym}</sup>{p.lbl}</span>)}
        </div>
      )}
      {q.questionText&&<div style={{fontSize:10,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:2}}><HL text={q.questionText.slice(0,50)}/>{q.questionText.length>50?"…":""}</div>}
      <div style={{display:"flex",justifyContent:"space-between",marginTop:2}}>
        <span style={{fontSize:9,color:rate!==null?(rate>=70?"#16a34a":rate>=40?"#f59e0b":"#dc2626"):"#94a3b8"}}>{rate!==null?`正答率${rate}%`:""}</span>
        <span style={{fontSize:9,color:"#94a3b8"}}>{last?`最終: ${last.date} ${last.r}`:""}</span>
      </div>
    </div>
  );
}

// ── DETAIL PAGE ──
function DetPage({q,books,onEdit,onDelete,onRecord,onClose}){
  const acc=q.missCount>=5?"#ef4444":q.missCount>=3?"#f59e0b":"#22c55e";
  const rk=RANKS.find(r=>r.id===q.rank)||RANKS[1];
  const pats=(q.ptns||[]).map(id=>PTNS.find(p=>p.id===id)).filter(Boolean);
  const hist=q.history||[];
  const cor=hist.filter(h=>h.r==="○").length;
  const rate=hist.length?Math.round(cor/hist.length*100):null;
  const last=hist.slice(-1)[0];
  const book=books?.find(b=>b.id===q.bookId);
  const textBook=books?.find(b=>b.id===q.textBookId);
  const bookType=book?BOOK_TYPES.find(t=>t.id===book.type):null;
  const subj=SUBJS.find(s=>s.full===q.subject);
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
        <div key={i} style={{marginBottom:11}}>
          {s.title&&<div style={{fontSize:11,fontWeight:900,marginBottom:4,padding:"3px 8px",borderRadius:5,background:isRev?"#f3e8ff":"#eff6ff",color:isRev?"#7c3aed":"#1d4ed8",borderLeft:`3px solid ${isRev?"#7c3aed":"#3b82f6"}`}}>{s.title}{isRev&&<span style={{marginLeft:6,fontSize:9,background:"#7c3aed",color:"#fff",borderRadius:3,padding:"1px 5px"}}>要確認</span>}</div>}
          <div style={{fontSize:12,lineHeight:1.9,whiteSpace:"pre-wrap"}}><HL text={txt}/></div>
        </div>
      );
    });
  };
  return(
    <div style={C.panel}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          <span style={{fontSize:9,background:"#0f2744",color:"#fff",borderRadius:5,padding:"2px 7px",fontWeight:700}}>{subj?.short}</span>
          <span style={{fontSize:9,background:rk.bg,color:rk.color,borderRadius:5,padding:"2px 7px",fontWeight:900}}>{rk.label}</span>
          <span style={{fontSize:9,background:acc,color:"#fff",borderRadius:20,padding:"2px 7px",fontWeight:900}}>×{q.missCount}</span>
          {rate!==null&&<span style={{fontSize:9,background:"#eff6ff",color:"#1d4ed8",borderRadius:5,padding:"2px 7px",fontWeight:700}}>正答率{rate}%</span>}
          {q.hasRev&&<span style={{fontSize:9,background:"#f3e8ff",color:"#7c3aed",borderRadius:20,padding:"2px 7px",fontWeight:700}}>🆕法改正</span>}
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#64748b",fontWeight:700}}>✕</button>
      </div>
      <div style={{marginBottom:10}}>
        {q.nendoNo&&<div style={{fontSize:13,fontWeight:900,color:"#0369a1",marginBottom:3}}>年度番号: {q.nendoNo}</div>}
        {q.qNo&&<div style={{fontSize:11,color:"#64748b",marginBottom:3}}>問題集番号: No.{q.qNo}</div>}
        {book&&<div style={{fontSize:10,marginBottom:3,display:"flex",alignItems:"center",gap:4}}>
          <span style={{background:bookType?.bg||"#f1f5f9",color:bookType?.color||"#64748b",borderRadius:4,padding:"1px 6px",fontWeight:700,fontSize:9}}>{bookType?.icon} {bookType?.label}</span>
          <span style={{color:"#64748b"}}>{book.name}</span>
        </div>}
        {textBook&&<div style={{fontSize:10,marginBottom:3,display:"flex",alignItems:"center",gap:4}}>
          <span style={{background:"#e0f2fe",color:"#0369a1",borderRadius:4,padding:"1px 6px",fontWeight:700,fontSize:9}}>📖 テキスト</span>
          <span style={{color:"#64748b"}}>{textBook.name}</span>
        </div>}
        {last&&<div style={{fontSize:10,color:"#94a3b8"}}>最後: <strong>{last.date}</strong>（{last.r}）</div>}
      </div>
      {pats.length>0&&(
        <div style={{marginBottom:10,padding:"8px 10px",background:"#fff7ed",borderRadius:8,border:"1px solid #fed7aa"}}>
          <div style={{fontSize:9,fontWeight:900,color:"#92400e",marginBottom:5}}>⚠️ 引っかけパターン</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {pats.map(p=><div key={p.id} title={p.tip} style={{background:p.bg,border:`1.5px solid ${p.c}`,color:p.c,borderRadius:7,padding:"3px 8px",fontSize:9,fontWeight:700,cursor:"help"}}><sup>{p.sym}</sup>{p.lbl} →{p.tip}</div>)}
          </div>
        </div>
      )}
      {q.sourceUrl&&<a href={q.sourceUrl} target="_blank" rel="noreferrer" style={{fontSize:10,color:"#0369a1",display:"block",marginBottom:8}}>🔗 {q.sourceUrl}</a>}
      {q.questionText&&(
        <div style={{marginBottom:12}}>
          <div style={{fontSize:9,fontWeight:900,color:"#64748b",marginBottom:4}}>📄 問題文</div>
          <div style={{fontSize:13,lineHeight:2,background:"#f8fafc",padding:"10px 12px",borderRadius:8,whiteSpace:"pre-wrap",maxHeight:220,overflowY:"auto",border:"1px solid #e2e8f0"}}><HL text={q.questionText}/></div>
        </div>
      )}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button onClick={()=>onRecord("×")} style={{flex:1,background:"#fee2e2",color:"#dc2626",border:"2px solid #fca5a5",borderRadius:8,padding:"9px",fontSize:12,fontWeight:900,cursor:"pointer"}}>❌ また間違えた</button>
        <button onClick={()=>onRecord("○")} style={{flex:1,background:"#dcfce7",color:"#16a34a",border:"2px solid #86efac",borderRadius:8,padding:"9px",fontSize:12,fontWeight:900,cursor:"pointer"}}>✅ 正解した</button>
      </div>
      {q.memo&&<div style={{marginBottom:10}}><div style={{fontSize:9,fontWeight:900,color:"#64748b",marginBottom:3}}>📝 メモ</div><div style={{fontSize:12,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{q.memo}</div></div>}
      {q.explanation&&(
        <div style={{marginBottom:10}}>
          <div style={{fontSize:9,fontWeight:900,color:"#64748b",marginBottom:5}}>✨ AI解説</div>
          <div style={{maxHeight:400,overflowY:"auto",background:"#f8fafc",borderRadius:10,padding:12,border:"1px solid #e2e8f0"}}>{renderExp(q.explanation)}</div>
        </div>
      )}
      <div style={{marginBottom:10}}>
        <div style={{fontSize:9,fontWeight:900,color:"#64748b",marginBottom:4}}>📊 解答履歴</div>
        {hist.length===0?<div style={{fontSize:10,color:"#94a3b8"}}>まだ解答記録がありません</div>:(
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {hist.slice().reverse().slice(0,30).map((h,i)=>(
              <span key={i} style={{fontSize:10,fontWeight:700,display:"flex",flexDirection:"column",alignItems:"center",background:"#f8fafc",borderRadius:5,padding:"2px 5px",color:h.r==="○"?"#16a34a":"#dc2626"}}>
                {h.r}<span style={{fontSize:8,color:"#94a3b8"}}>{h.date.slice(5)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button onClick={onDelete} style={{background:"#fef2f2",color:"#dc2626",border:"1.5px solid #fca5a5",borderRadius:7,padding:"7px 16px",fontSize:11,fontWeight:700,cursor:"pointer"}}>🗑 削除</button>
        <button onClick={onEdit} style={{background:"#f1f5f9",color:"#475569",border:"none",borderRadius:7,padding:"7px 16px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✏️ 編集</button>
      </div>
    </div>
  );
}

// ── ADD PAGE ──
function AddPage({form,setForm,books,aiBusy,aiOut,aiErr,pdfMap,setPdfMap,imgRef,onRunAI,onSave,onCancel,onAddBook,onDeleteBook}){
  const s=(k,v)=>setForm(f=>({...f,[k]:v}));
  const pdfRef=useRef();
  const[newBook,setNewBook]=useState("");
  const[newBookType,setNewBookType]=useState("ichi");
  const livePats=PTNS.filter(p=>p.kw.some(kw=>(form.questionText||"").includes(kw)));
  const liveRev=REV_KW.some(kw=>(form.questionText||"").includes(kw));

  // PDF複数アップ（問題集ごと or まとめて）
  const handlePdf=e=>{
    const files=Array.from(e.target.files||[]);
    files.forEach(file=>{
      const key=form.bookId||`pdf_${Date.now()}_${file.name}`;
      const r=new FileReader();
      r.onload=ev=>setPdfMap(m=>({...m,[key]:{b64:ev.target.result.split(",")[1],name:file.name}}));
      r.readAsDataURL(file);
    });
    e.target.value="";
  };

  const pdfEntries=Object.entries(pdfMap);

  return(
    <div style={C.panel}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:15,fontWeight:900,color:"#0f2744"}}>{form._new?"新規ミス問登録":"問題を編集"}</div>
        <button onClick={onCancel} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:"#64748b",fontWeight:700}}>✕ キャンセル</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
        {/* 左列 */}
        <div>
          <Sec title="📚 科目・番号">
            <L>科目</L>
            <select style={C.inp} value={form.subject} onChange={e=>s("subject",e.target.value)}>
              {SUBJS.map(sub=><option key={sub.full} value={sub.full}>{sub.short}｜{sub.full}</option>)}
            </select>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div>
                <L>年度番号</L>
                <input style={C.inp} placeholder="例: R06-01A" value={form.nendoNo} onChange={e=>s("nendoNo",e.target.value)}/>
                <div style={{fontSize:9,color:"#94a3b8",marginTop:2}}>共通キー（全員で共有）</div>
              </div>
              <div>
                <L>問題集番号</L>
                <input style={C.inp} placeholder="例: No.234" value={form.qNo} onChange={e=>s("qNo",e.target.value)}/>
                <div style={{fontSize:9,color:"#94a3b8",marginTop:2}}>各自の問題集番号</div>
              </div>
            </div>
            <L>問題集を紐付け</L>
            <select style={C.inp} value={form.bookId||""} onChange={e=>s("bookId",e.target.value||null)}>
              <option value="">— なし —</option>
              {books.filter(b=>b.type!=="text").map(b=>{
                const bt=BOOK_TYPES.find(t=>t.id===b.type);
                return <option key={b.id} value={b.id}>{bt?.icon} [{bt?.label||b.type}] {b.name}</option>;
              })}
            </select>
            <L>テキストを紐付け（参照用）</L>
            <select style={C.inp} value={form.textBookId||""} onChange={e=>s("textBookId",e.target.value||null)}>
              <option value="">— なし —</option>
              {books.filter(b=>b.type==="text").map(b=>(
                <option key={b.id} value={b.id}>📖 {b.name}</option>
              ))}
            </select>
            <div style={{display:"flex",gap:5,marginTop:5}}>
              <input style={{...C.inp,flex:1}} placeholder="問題集名を追加…" value={newBook} onChange={e=>setNewBook(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&newBook.trim()){onAddBook({id:`b_${Date.now()}`,name:newBook.trim(),type:newBookType});setNewBook("");}}}/>
              <button onClick={()=>{if(newBook.trim()){onAddBook({id:`b_${Date.now()}`,name:newBook.trim(),type:newBookType});setNewBook("");}}} style={{...C.btnP,padding:"6px 10px"}}>＋</button>
            </div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:5}}>
              {BOOK_TYPES.map(t=>(
                <button key={t.id} onClick={()=>setNewBookType(t.id)}
                  style={{fontSize:9,padding:"3px 8px",borderRadius:12,cursor:"pointer",fontWeight:700,border:`1.5px solid ${t.color}`,background:newBookType===t.id?t.color:t.bg,color:newBookType===t.id?"#fff":t.color}}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            {books.length>0&&(
              <div style={{marginTop:6}}>
                {BOOK_TYPES.map(bt=>{
                  const booksOfType=books.filter(b=>b.type===bt.id);
                  if(booksOfType.length===0)return null;
                  return(
                    <div key={bt.id} style={{marginBottom:6}}>
                      <div style={{fontSize:9,fontWeight:900,color:bt.color,marginBottom:3}}>{bt.icon} {bt.label}</div>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                        {booksOfType.map(b=>(
                          <div key={b.id} style={{fontSize:9,background:bt.bg,border:`1px solid ${bt.color}44`,borderRadius:5,padding:"2px 7px",display:"flex",alignItems:"center",gap:4,color:bt.color}}>
                            {b.name}
                            <button onClick={()=>onDeleteBook(b.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:10,padding:0}}>✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Sec>
          <Sec title="⭐ ランク・設定">
            <L>難易度ランク（AI自動判定 or 手動変更）</L>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {RANKS.map(r=>(
                <button key={r.id} onClick={()=>s("rank",r.id)}
                  style={{padding:"3px 8px",borderRadius:12,fontSize:10,fontWeight:900,cursor:"pointer",border:`1.5px solid ${r.color}`,background:form.rank===r.id?r.color:r.bg,color:form.rank===r.id?"#fff":r.color}}>
                  {r.label}
                </button>
              ))}
            </div>
            <L>ミス回数</L>
            <input type="number" style={C.inp} min={0} value={form.missCount} onChange={e=>s("missCount",Number(e.target.value))}/>
            <L>メモ</L>
            <textarea style={{...C.inp,height:70,resize:"vertical"}} placeholder="要点・ひっかけ・覚え方…" value={form.memo} onChange={e=>s("memo",e.target.value)}/>
          </Sec>
        </div>
        {/* 右列 */}
        <div>
          <Sec title="📝 入力方法">
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4,marginBottom:10}}>
              {[["number","🔢","番号"],["text","✏️","入力"],["url","🌐","URL"],["pdf","📄","PDF"],["image","📷","画像"]].map(([m,ic,lb])=>(
                <button key={m} onClick={()=>s("inputMode",m)}
                  style={{padding:"7px 4px",border:`2px solid ${form.inputMode===m?"#3b82f6":"#e2e8f0"}`,borderRadius:8,fontSize:10,fontWeight:700,cursor:"pointer",background:form.inputMode===m?"#eff6ff":"#f8fafc",color:form.inputMode===m?"#1d4ed8":"#64748b",textAlign:"center"}}>
                  <div>{ic}</div><div style={{fontSize:9}}>{lb}</div>
                </button>
              ))}
            </div>
            {form.inputMode==="text"&&(
              <>
                <L>問題文</L>
                <textarea style={{...C.inp,height:160,resize:"vertical"}} placeholder="問題文をそのまま貼り付け。複数問・1ページまるごとでもOK。" value={form.questionText} onChange={e=>s("questionText",e.target.value)}/>
                {(livePats.length>0||liveRev)&&(
                  <div style={{marginTop:6,padding:"7px 10px",background:"#fff7ed",borderRadius:7,border:"1px solid #fed7aa"}}>
                    <div style={{fontSize:9,fontWeight:900,color:"#c2410c",marginBottom:4}}>⚠️ 引っかけを検出！</div>
                    <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                      {livePats.map(p=><span key={p.id} title={p.tip} style={{background:p.bg,color:p.c,borderRadius:6,padding:"1px 6px",fontSize:9,fontWeight:700}}><sup>{p.sym}</sup>{p.lbl}</span>)}
                      {liveRev&&<span style={{background:"#f3e8ff",color:"#7c3aed",borderRadius:6,padding:"1px 6px",fontSize:9,fontWeight:700}}>🆕法改正</span>}
                    </div>
                  </div>
                )}
              </>
            )}
            {form.inputMode==="url"&&(
              <>
                <L>本試験問題のURL（srsaitan.jpなど）</L>
                <input style={C.inp} placeholder="例: https://srsaitan.jp/wp-content/uploads/archives/57takuitusiki.pdf" value={form.sourceUrl} onChange={e=>s("sourceUrl",e.target.value)}/>
                <div style={{fontSize:9,color:"#64748b",marginTop:3}}>srsaitan.jpの本試験PDFのURL → 問題番号入力でAI解説</div>
              </>
            )}
            {(form.inputMode==="pdf"||form.inputMode==="number")&&(
              <div style={{marginTop:8}}>
                <L>PDFをアップ（複数同時選択可）</L>
                {pdfEntries.length>0&&(
                  <div style={{marginBottom:6,display:"flex",flexDirection:"column",gap:4}}>
                    {pdfEntries.map(([key,val])=>(
                      <div key={key} style={{background:"#f0fdf4",border:"1px solid #86efac",borderRadius:7,padding:"5px 9px",fontSize:10,color:"#166534",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        📄 {val.name}
                        <button onClick={()=>setPdfMap(m=>{const n={...m};delete n[key];return n;})} style={{fontSize:10,background:"none",border:"none",cursor:"pointer",color:"#dc2626"}}>削除</button>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={()=>pdfRef.current?.click()} style={{background:"#0369a1",color:"#fff",border:"none",borderRadius:7,padding:"8px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                  📂 PDFを追加（複数同時選択可）
                </button>
                <input ref={pdfRef} type="file" accept="application/pdf" multiple style={{display:"none"}} onChange={handlePdf}/>
                <L>ページ指定</L>
                <input style={C.inp} placeholder="例: 15〜20ページ" value={form.pageRange||""} onChange={e=>s("pageRange",e.target.value)}/>
              </div>
            )}
            {form.inputMode==="image"&&(
              <button onClick={()=>imgRef.current?.click()} disabled={aiBusy}
                style={{background:"#7c3aed",color:"#fff",border:"none",borderRadius:7,padding:"8px 12px",fontSize:11,fontWeight:700,cursor:"pointer",marginTop:8}}>
                📷 画像をアップ（複数問・1ページまるごとOK）
              </button>
            )}
          </Sec>
          <Sec title="🤖 AI解説">
            <div style={{fontSize:10,color:"#0369a1",background:"#eff6ff",borderRadius:6,padding:"5px 8px",marginBottom:8}}>
              💡 年度番号（R06-01Aなど）を入力すると共有DBから自動取得します
            </div>
            <button onClick={onRunAI} disabled={aiBusy} style={{...C.btnP,width:"100%",marginBottom:8,opacity:aiBusy?.6:1}}>
              {aiBusy?"⏳ 解説生成中…":"✨ AI解説を取得"}
            </button>
            {aiBusy&&<div style={{height:3,background:"#e2e8f0",borderRadius:3,overflow:"hidden",marginBottom:7}}><div className="pr"/></div>}
            {aiErr&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:7,padding:9,fontSize:11,color:"#dc2626",marginBottom:7}}>{aiErr}</div>}
            {aiOut&&(
              <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:9,padding:11,marginBottom:8,maxHeight:240,overflowY:"auto"}}>
                <div style={{fontSize:10,fontWeight:900,color:"#0369a1",marginBottom:5}}>✨ プレビュー</div>
                <pre style={{fontSize:11,whiteSpace:"pre-wrap",fontFamily:"inherit",lineHeight:1.8}}>{aiOut.replace(/RANK:[GABCDEF]/g,"")}</pre>
              </div>
            )}
            <L>解説テキスト</L>
            <textarea style={{...C.inp,height:110,resize:"vertical"}} placeholder="AI解説がここに入ります。" value={form.explanation||""} onChange={e=>s("explanation",e.target.value)}/>
          </Sec>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16,paddingTop:14,borderTop:"1px solid #f1f5f9"}}>
        <button onClick={onCancel} style={C.btnS}>キャンセル</button>
        <button onClick={onSave} style={C.btnP}>💾 保存する</button>
      </div>
    </div>
  );
}

// ── BATCH PAGE ──
function BatchPage({aiBusy,batchText,setBatchText,batchResult,onRun,imgRef}){
  return(
    <div style={C.panel}>
      <div style={{fontSize:15,fontWeight:900,color:"#0f2744",marginBottom:6}}>📦 まとめ解説</div>
      <div style={{fontSize:11,color:"#64748b",marginBottom:12}}>複数問・5肢一択・1ページをまとめて貼り付けてAI解説。画像でもOK。「R06-01AとH28-1イの解説を教えて」もOK。</div>
      <textarea style={{...C.inp,height:180,resize:"vertical",marginBottom:10,width:"100%"}}
        placeholder="問題文をそのまま貼り付け（複数問OK）&#10;または「R06-01AとR06-01Bの解説を教えて」のように指定"
        value={batchText} onChange={e=>setBatchText(e.target.value)}/>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <button onClick={onRun} disabled={aiBusy} style={{...C.btnP,flex:1,opacity:aiBusy?.6:1}}>
          {aiBusy?"⏳ 解説生成中…":"✨ まとめてAI解説"}
        </button>
        <button onClick={()=>imgRef.current?.click()} disabled={aiBusy}
          style={{background:"#7c3aed",color:"#fff",border:"none",borderRadius:7,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
          📷 画像から解説
        </button>
      </div>
      {aiBusy&&<div style={{height:3,background:"#e2e8f0",borderRadius:3,overflow:"hidden",marginBottom:10}}><div className="pr"/></div>}
      {batchResult&&(
        <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:10,padding:14}}>
          <div style={{fontSize:11,fontWeight:900,color:"#0369a1",marginBottom:8}}>✨ まとめ解説</div>
          <pre style={{fontSize:12,whiteSpace:"pre-wrap",fontFamily:"inherit",lineHeight:1.9}}>{batchResult}</pre>
        </div>
      )}
    </div>
  );
}

// ── SHARED PAGE ──
function SharedPage({fetchAll}){
  const[items,setItems]=useState([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  useEffect(()=>{ fetchAll().then(d=>{setItems(d);setLoading(false);}); },[]);
  const filtered=items.filter(i=>!search||JSON.stringify(i).toLowerCase().includes(search.toLowerCase()));
  return(
    <div style={C.panel}>
      <div style={{fontSize:15,fontWeight:900,color:"#0f2744",marginBottom:4}}>🌐 共有問題データベース</div>
      <div style={{fontSize:11,color:"#64748b",marginBottom:10}}>誰かが年度番号を登録すると問題文・AI解説が全員に共有されます。</div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 年度番号・科目で検索…" style={{width:"100%",padding:"8px 12px",border:"1.5px solid #e2e8f0",borderRadius:9,fontSize:13,marginBottom:10,background:"#f8fafc"}}/>
      {loading?<div style={{textAlign:"center",padding:"20px",color:"#94a3b8"}}>読み込み中…</div>:(
        filtered.length===0?<div style={{textAlign:"center",padding:"20px",color:"#94a3b8"}}>まだ共有データはありません。問題を登録して共有しましょう！</div>
        :<div style={{display:"flex",flexDirection:"column",gap:7}}>
          {filtered.map(item=>{
            const subj=SUBJS.find(s=>s.full===item.subject);
            return(
              <div key={item.id} style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",border:"1px solid #e2e8f0"}}>
                <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
                  {subj&&<span style={{fontSize:9,background:"#0f2744",color:"#fff",borderRadius:4,padding:"1px 6px",fontWeight:700}}>{subj.short}</span>}
                  <span style={{fontSize:11,fontWeight:900,color:"#0369a1"}}>{item.nendo_no}</span>
                  {item.has_rev&&<span style={{fontSize:9,background:"#f3e8ff",color:"#7c3aed",borderRadius:4,padding:"1px 5px",fontWeight:700}}>🆕</span>}
                  <span style={{fontSize:9,color:"#94a3b8",marginLeft:"auto"}}>{item.updated_at?.slice(0,10)}</span>
                </div>
                {item.question_text&&<div style={{fontSize:11,color:"#1e293b",marginBottom:4,lineHeight:1.7}}>{item.question_text.slice(0,120)}{item.question_text.length>120?"…":""}</div>}
                {item.explanation&&<div style={{fontSize:10,color:"#0369a1"}}>✨ AI解説あり</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── PRIMITIVES ──
function Sec({title,children}){return<div style={{marginBottom:16,paddingBottom:14,borderBottom:"1px solid #f1f5f9"}}><div style={{fontSize:11,fontWeight:900,color:"#0f2744",marginBottom:8}}>{title}</div>{children}</div>;}
function L({children}){return<div style={{fontSize:10,color:"#64748b",fontWeight:700,marginBottom:3,marginTop:7}}>{children}</div>;}

const C={
  panel:{background:"#fff",borderRadius:13,padding:16,boxShadow:"0 2px 8px rgba(0,0,0,.07)"},
  card:{background:"#fff",borderRadius:12,padding:14,boxShadow:"0 2px 8px rgba(0,0,0,.07)"},
  cardT:{fontSize:12,fontWeight:900,color:"#0f2744",marginBottom:10,paddingBottom:6,borderBottom:"1px solid #f1f5f9"},
  inp:{width:"100%",padding:"7px 10px",border:"1.5px solid #e2e8f0",borderRadius:7,fontSize:12,color:"#1e293b",background:"#f8fafc",boxSizing:"border-box",fontFamily:"inherit"},
  sel:{padding:"6px 8px",border:"1.5px solid #e2e8f0",borderRadius:7,fontSize:11,background:"#fff",color:"#1e293b",flex:1,minWidth:80},
  btnP:{background:"#0f2744",color:"#fff",border:"none",borderRadius:7,padding:"9px 20px",fontSize:12,fontWeight:700,cursor:"pointer"},
  btnS:{background:"#f1f5f9",color:"#475569",border:"none",borderRadius:7,padding:"9px 20px",fontSize:12,fontWeight:700,cursor:"pointer"},
};