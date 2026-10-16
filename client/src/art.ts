// Atlases are loaded and their transparent bounds computed once, never in the frame loop.
export type SpriteFrame={sx:number;sy:number;sw:number;sh:number;anchor:number;height:number};
export const art={fighters:new Image(),run:new Image(),village:new Image(),poses:[] as SpriteFrame[][],runs:[] as SpriteFrame[][],ready:false};
let promise:Promise<void>|null=null;
function image(img:HTMLImageElement,url:string){return new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('Không tải được tài nguyên '+url+'. Kiểm tra thư mục client/public/art và build lại.'));img.src=url;});}
function frames(img:HTMLImageElement,cols:number,rows:number):SpriteFrame[][]{
 const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const c=canvas.getContext('2d',{willReadFrequently:true})!;c.drawImage(img,0,0);const pixels=c.getImageData(0,0,img.width,img.height).data;
 return Array.from({length:rows},(_,row)=>Array.from({length:cols},(_,col)=>{
  const x0=Math.round(col*img.width/cols),x1=Math.round((col+1)*img.width/cols),y0=Math.round(row*img.height/rows),y1=Math.round((row+1)*img.height/rows);
  let minX=x1,minY=y1,maxX=x0,maxY=y0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(pixels[(y*img.width+x)*4+3]>64){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  if(maxX<minX)throw new Error('Sprite rỗng ở hàng '+row+', cột '+col);
  return {sx:minX,sy:minY,sw:maxX-minX+1,sh:maxY-minY+1,anchor:.5,height:maxY-minY+1};
 }));
}
export function loadArt(){if(!promise)promise=Promise.all([image(art.fighters,'/art/fighters-v2.png'),image(art.run,'/art/run-v2.png'),image(art.village,'/art/village-v2.png')]).then(()=>{
 art.poses=frames(art.fighters,8,4);art.runs=frames(art.run,4,4);
 // All poses in a row share the idle scale; no stretching when kicking or crouching.
 art.poses.forEach((row,i)=>{row.forEach((f,j)=>{f.height=row[0].sh;f.anchor=[.5,.48,.5,.39,.28,.5,.56,.43][j];});art.runs[i].forEach(f=>{f.height=art.runs[i][0].sh;f.anchor=.48;});});art.ready=true;
 });return promise;}
