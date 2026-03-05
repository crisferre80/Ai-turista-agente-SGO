import fetch from 'node-fetch';

(async()=>{
 try{
   const r=await fetch('http://localhost:3000/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'x'.repeat(600),target:'en'})});
   console.log('status',r.status);
   console.log(await r.text());
 }catch(e){console.error('fetch error',e)}
})();