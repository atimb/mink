// Optional portable single-file edition. Sources remain in the project folder.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const destination=path.resolve(process.argv[2]||path.join(root,'Mink.html'));
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+fs.readFileSync(path.join(root,'style.css'),'utf8')+'</style>');
for(const name of ['assets.js','core.js','renderer.js','touch.js','app.js']) {
  html=html.replace(`<script defer src="${name}"></script>`,'');
}
const scripts=['assets.js','core.js','renderer.js','touch.js','app.js'].map(name=>'<script>\n'+fs.readFileSync(path.join(root,name),'utf8').replace(/<\/script/gi,'<\\/script')+'\n</script>').join('\n');
html=html.replace('</body>',()=>scripts+'\n</body>');
fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,html);
console.log('Saved '+destination);
