export function cleanName(value){return String(value??'Đấu sĩ').replace(/[<>\x00-\x1f]/g,'').trim().slice(0,20)||'Đấu sĩ';}
