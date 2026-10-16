import {B,FLOOR} from '../../shared/engine.mjs';
export const TOUCH_JUMP=B.jump|B.up;
export function actionMessage(player,phase,bit){
 if(phase!=='fight')return 'Chờ bắt đầu hiệp đấu.';
 if(bit===B.burst){
  if(player.burst>0)return 'Bộc phát đang hoạt động: tăng 12% sát thương và 10% tốc độ, kéo dài 8 giây.';
  if(player.energy<299.9)return `Bộc phát cần đầy 3 vạch năng lượng (300). Hiện có ${Math.floor(player.energy)}/300. Đánh trúng hoặc nhận đòn để tích năng lượng.`;
  if(player.y<FLOOR)return 'Chạm đất rồi bấm Bộc phát.';
  if(player.stun>0||player.state==='attack'||player.state==='roll')return 'Đợi hết đòn đánh, choáng hoặc lăn rồi bấm Bộc phát.';
 }
 if(bit===B.super&&player.energy<100)return `Tuyệt chiêu cần 100 năng lượng. Hiện có ${Math.floor(player.energy)}/100.`;
 return '';
}
export function viewportSize(width,height,touch){const wide=touch&&width>height;return {width:960,height:wide?Math.max(270,Math.round(960*height/width)):540,wide};}
