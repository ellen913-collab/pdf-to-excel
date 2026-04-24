import { useState } from 'react';
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs';

export default function Home() {
  const [file, setFile] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadName, setDownloadName] = useState('');
  const [dragging, setDragging] = useState(false);

  function handleFile(f) {
    if (!f || f.type !== 'application/pdf') { setError('請選擇 PDF 格式的檔案'); return; }
    if (f.size > 20 * 1024 * 1024) { setError('檔案大小不可超過 20MB'); return; }
    setFile(f); setError(''); setStatus('idle'); setDownloadUrl('');
  }

  async function convert() {
    if (!file) return;
    setStatus('loading'); setError(''); setDownloadUrl('');
    try {
      const base64 = await toBase64(file);
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: base64, userPrompt: prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '轉換失敗');
      if (!data.sheets || data.sheets.length === 0) throw new Error(data.message || '找不到表格資料');

      const { utils, write } = await import('https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs');
      const wb = utils.book_new();
      data.sheets.forEach((s, i) => {
        const rows = [];
        if (s.headers?.length) rows.push(s.headers);
        (s.rows || []).forEach(r => rows.push(r));
        utils.book_append_sheet(wb, utils.aoa_to_sheet(rows), s.name || `工作表${i+1}`);
      });
      const buf = write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buf], { type: 'application/octet-stream' });
      setDownloadUrl(URL.createObjectURL(blob));
      setDownloadName(file.name.replace(/\.pdf$/i, '') + '.xlsx');
      setStatus('success');
    } catch (e) {
      setError(e.message); setStatus('error');
    }
  }

  function toBase64(f) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(',')[1]);
      r.onerror = () => rej(new Error('檔案讀取失敗'));
      r.readAsDataURL(f);
    });
  }

  return (
    <div style={{minHeight:'100vh',background:'#f5f3ef',display:'flex',alignItems:'center',justifyContent:'center',padding:'2rem 1rem',fontFamily:'sans-serif'}}>
      <div style={{background:'white',borderRadius:20,boxShadow:'0 4px 24px rgba(0,0,0,.08)',padding:'2.5rem',width:'100%',maxWidth:520}}>
        <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:28}}>
          <div style={{width:52,height:52,background:'#2563eb',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'white',fontSize:24}}>📄</span>
          </div>
          <div>
            <h1 style={{fontSize:'1.3rem',fontWeight:700,margin:0}}>PDF 轉 Excel</h1>
            <p style={{fontSize:'0.82rem',color:'#6b6560',margin:0}}>上傳 PDF，自動擷取表格並下載 Excel</p>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e=>{e.preventDefault();setDragging(true)}}
          onDragLeave={()=>setDragging(false)}
          onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0])}}
          onClick={()=>document.getElementById('fi').click()}
          style={{border:`2px dashed ${dragging?'#2563eb':'#e2ddd8'}`,borderRadius:14,padding:'2rem',textAlign:'center',cursor:'pointer',background:dragging?'#eff6ff':'#f5f3ef',transition:'all .2s'}}>
          <input id="fi" type="file" accept=".pdf" style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])} />
          <div style={{fontSize:36,marginBottom:8}}>📂</div>
          <p style={{fontWeight:600,margin:'0 0 4px'}}>拖曳 PDF 到這裡</p>
          <p style={{fontSize:'0.82rem',color:'#6b6560',margin:0}}>或點此選擇檔案（最大 20MB）</p>
        </div>

        {/* File info */}
        {file && (
          <div style={{display:'flex',alignItems:'center',gap:12,background:'#eff6ff',border:'1.5px solid #2563eb',borderRadius:12,padding:'0.8rem 1rem',marginTop:12}}>
            <span style={{fontSize:22}}>📄</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:'0.9rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{file.name}</div>
              <div style={{fontSize:'0.78rem',color:'#6b6560'}}>{(file.size/1024).toFixed(1)} KB</div>
            </div>
            <button onClick={()=>{setFile(null);setStatus('idle');setDownloadUrl('');}} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:'#6b6560'}}>✕</button>
          </div>
        )}

        {/* Prompt */}
        <div style={{marginTop:14}}>
          <label style={{fontSize:'0.78rem',fontWeight:600,color:'#6b6560',textTransform:'uppercase',letterSpacing:'.04em',display:'block',marginBottom:4}}>補充說明（可留空）</label>
          <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows={2}
            placeholder="例如：請特別注意金額欄位…"
            style={{width:'100%',border:'1.5px solid #e2ddd8',borderRadius:10,padding:'0.7rem 1rem',fontSize:'0.88rem',fontFamily:'sans-serif',resize:'none',boxSizing:'border-box',background:'#f5f3ef'}} />
        </div>

        {/* Button */}
        <button onClick={convert} disabled={!file||status==='loading'}
          style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,width:'100%',padding:'0.85rem',background:'#2563eb',color:'white',border:'none',borderRadius:12,fontSize:'1rem',fontWeight:700,cursor:(!file||status==='loading')?'not-allowed':'pointer',marginTop:14,opacity:(!file||status==='loading')?0.55:1,transition:'opacity .2s'}}>
          {status==='loading' ? '⏳ AI 分析中，請稍候…' : '⚡ 開始轉換'}
        </button>

        {/* Status */}
        {status==='success' && (
          <>
            <div style={{display:'flex',alignItems:'center',gap:8,background:'#f0fdf4',border:'1.5px solid #bbf7d0',borderRadius:12,padding:'0.9rem 1.2rem',marginTop:12,color:'#16a34a',fontWeight:600}}>
              ✅ 轉換完成！
            </div>
            <a href={downloadUrl} download={downloadName}
              style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,width:'100%',padding:'0.8rem',background:'#16a34a',color:'white',border:'none',borderRadius:12,fontSize:'0.95rem',fontWeight:700,cursor:'pointer',marginTop:8,textDecoration:'none',boxSizing:'border-box'}}>
              ⬇️ 下載 Excel 檔案
            </a>
          </>
        )}
        {error && (
          <div style={{background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:12,padding:'0.9rem 1.2rem',marginTop:12,color:'#dc2626',fontSize:'0.88rem'}}>
            ⚠️ {error}
          </div>
        )}

        <p style={{textAlign:'center',fontSize:'0.75rem',color:'#9ca3af',marginTop:16,marginBottom:0}}>檔案僅用於本次轉換，不會被儲存</p>
      </div>
    </div>
  );
}
