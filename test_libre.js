import fetch from 'node-fetch';
(async()=>{
 try{
   const r=await fetch('https://libretranslate.com/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:'hola mundo',source:'es',target:'en',format:'text'})});
   console.log('status',r.status);
   console.log(await r.text());
 }catch(e){console.error('error',e)}
})();