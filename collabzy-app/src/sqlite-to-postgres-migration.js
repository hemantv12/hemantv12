const fs=require('node:fs');
const path=require('node:path');
const Database=require('better-sqlite3');

const TABLES=[
  {name:'users',columns:['id','name','email','password_hash','role','niche','bio','location','instagram_handle','instagram_user_id','instagram_access_token_enc','instagram_connected_at','instagram_token_expires_at','followers','engagement','created_at'],defaults:{niche:'',bio:'',location:'',instagram_handle:'',instagram_user_id:'',instagram_access_token_enc:'',instagram_connected_at:null,instagram_token_expires_at:null,followers:0,engagement:0,created_at:()=>new Date().toISOString()},timestamps:['instagram_connected_at','instagram_token_expires_at','created_at']},
  {name:'campaigns',columns:['id','brand_id','title','brand_name','description','category','collaboration_type','budget_min','budget_max','deliverables','location','status','created_at'],defaults:{budget_min:0,budget_max:0,deliverables:'',location:'India',status:'active',created_at:()=>new Date().toISOString()},timestamps:['created_at']},
  {name:'applications',columns:['id','campaign_id','creator_id','pitch','proposed_rate','status','created_at'],defaults:{pitch:'',proposed_rate:0,status:'pending',created_at:()=>new Date().toISOString()},timestamps:['created_at']},
  {name:'saved_campaigns',columns:['user_id','campaign_id','created_at'],defaults:{created_at:()=>new Date().toISOString()},timestamps:['created_at']},
  {name:'conversations',columns:['id','application_id','creator_id','brand_id','created_at','updated_at'],defaults:{created_at:()=>new Date().toISOString(),updated_at:()=>new Date().toISOString()},timestamps:['created_at','updated_at']},
  {name:'messages',columns:['id','conversation_id','sender_id','body','created_at','read_at'],defaults:{created_at:()=>new Date().toISOString(),read_at:null},timestamps:['created_at','read_at']},
  {name:'notifications',columns:['id','user_id','title','body','kind','entity_id','read_at','created_at'],defaults:{kind:'general',entity_id:0,read_at:null,created_at:()=>new Date().toISOString()},timestamps:['read_at','created_at']},
  {name:'campaign_invitations',columns:['id','campaign_id','brand_id','creator_id','message','status','created_at'],defaults:{message:'',status:'pending',created_at:()=>new Date().toISOString()},timestamps:['created_at']}
];

async function migrateLegacySQLite(pool,sourcePath){
  const resolved=path.resolve(sourcePath);
  if(!fs.existsSync(resolved))return {skipped:'SQLite migration source file was not found',sourcePath:resolved};
  const sqlite=new Database(resolved,{readonly:true,fileMustExist:true});
  const client=await pool.connect();
  try{
    await client.query("CREATE TABLE IF NOT EXISTS collabzy_migrations(name TEXT PRIMARY KEY,completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,details JSONB NOT NULL DEFAULT '{}'::jsonb)");
    const name='sqlite_import:'+resolved;
    const done=await client.query('SELECT name FROM collabzy_migrations WHERE name=$1',[name]);
    if(done.rows.length)return {skipped:'This SQLite file was already imported',sourcePath:resolved};
    const counts=await client.query("SELECT (SELECT COUNT(*) FROM users)::int AS users,(SELECT COUNT(*) FROM campaigns)::int AS campaigns,(SELECT COUNT(*) FROM applications)::int AS applications");
    if(Number(counts.rows[0].users)||Number(counts.rows[0].campaigns)||Number(counts.rows[0].applications)){
      throw Error('SQLite migration refused because PostgreSQL already contains user or campaign data. Back up and reconcile both databases before merging.');
    }
    const available=new Set(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name));
    const tables=TABLES.filter(table=>available.has(table.name));
    const details={sourcePath:resolved,tables:{},startedAt:new Date().toISOString()};
    await client.query('BEGIN');
    for(const table of tables){
      const rows=sqlite.prepare('SELECT * FROM "'+table.name+'"').all();
      details.tables[table.name]=rows.length;
      if(!rows.length)continue;
      const availableColumns=new Set(Object.keys(rows[0]));
      const columns=table.columns.filter(column=>availableColumns.has(column)||Object.hasOwn(table.defaults,column));
      const identifiers=columns.map(column=>'"'+column+'"').join(',');
      const slots=columns.map((_,index)=>'$'+(index+1)).join(',');
      const insert='INSERT INTO "'+table.name+'" ('+identifiers+') VALUES ('+slots+') ON CONFLICT DO NOTHING';
      for(const row of rows){
        const values=columns.map(column=>{
          let value=availableColumns.has(column)?row[column]:table.defaults[column];
          if(typeof value==='function')value=value();
          if(value===undefined)value=null;
          if(table.timestamps.includes(column)&&(value===''||value===undefined))value=null;
          return value;
        });
        await client.query(insert,values);
      }
    }
    for(const table of TABLES.filter(item=>item.columns.includes('id'))){
      const maximum=await client.query('SELECT COALESCE(MAX(id),0)::bigint AS max_id FROM "'+table.name+'"');
      const max=Number(maximum.rows[0].max_id);
      const sequence=await client.query("SELECT pg_get_serial_sequence($1,'id') AS name",[table.name]);
      if(sequence.rows[0].name){
        if(max>0)await client.query('SELECT setval($1,$2,true)',[sequence.rows[0].name,max]);
        else await client.query('SELECT setval($1,1,false)',[sequence.rows[0].name]);
      }
    }
    details.completedAt=new Date().toISOString();
    await client.query('INSERT INTO collabzy_migrations(name,details) VALUES($1,$2::jsonb)',[name,JSON.stringify(details)]);
    await client.query('COMMIT');
    return {imported:true,details};
  }catch(error){
    try{await client.query('ROLLBACK')}catch{}
    throw error;
  }finally{
    client.release();
    sqlite.close();
  }
}
module.exports={migrateLegacySQLite};
