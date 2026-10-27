// Optional preview. Usage: node server.cjs [port] [host]
// Defaults to localhost; supply the PC's LAN address for phone testing.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname,port=Number(process.argv[2]||8080),host=process.argv[3]||'127.0.0.1';
const publicFiles=new Set(['/index.html','/style.css','/assets.js','/core.js','/renderer.js','/touch.js','/app.js']);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
http.createServer((req,res)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
  if(pathname==='/')pathname='/index.html';
  // Serve the game only, including when bound to a LAN interface. Never expose .git.
  if(!publicFiles.has(pathname)){res.writeHead(404);res.end('Not found');return;}
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  });
}).listen(port,host,()=>console.log(`Mink: http://${host}:${port}`));
