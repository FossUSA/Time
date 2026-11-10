
/* Encrypted per-profile myTIME cloud backup. Passphrase stays in memory and is never sent to the server. */
(function(){
 'use strict';
 const API='https://foss-mytime-sync.jowu-eee.workers.dev/v1/backup';
 const el=id=>document.getElementById(id);
 const email=el('cloudAccountEmail'),pass=el('cloudPassphrase'),unlock=el('cloudUnlockBtn'),backup=el('cloudBackupBtn'),restore=el('cloudRestoreBtn'),lock=el('cloudLockBtn'),status=el('cloudSyncStatusText'),updated=el('cloudSyncUpdated');
 if(!email||!pass||!unlock)return;
 let session=null, busy=false, timer=null, remoteMeta=null;
 function setStorageBadge(){
  // This optional encrypted backup is separate from automatic Cloudflare D1
  // storage. Its state is shown in its own panel, never in the primary save indicator.
 }
 function setStatus(message,kind='info'){
  status.textContent=message;
  const root=el('cloudSyncStatus');
  root.classList.toggle('save-status-error',kind==='error');
  root.classList.toggle('save-status-ok',kind==='success');
  if(session&&remoteMeta?.exists&&kind==='success')setStorageBadge('Cloud backup confirmed','An encrypted cloud copy exists. Changes auto-back up while this profile remains unlocked.','success');
  else if(session&&!remoteMeta?.exists)setStorageBadge('Cloud profile connected · first backup needed','Your profile is unlocked, but no cloud backup exists yet. Create the first backup to protect records across devices.','info');
  else if(!session)setStorageBadge('Cloud status requires sign-in','Local records are saved in this browser. Unlock your cloud profile to check the remote backup and sync changes.','info');
 }
 function setButtons(){unlock.disabled=busy;backup.disabled=busy||!session;restore.disabled=busy||!session||!remoteMeta?.exists;lock.disabled=busy||!session}
 const enc=new TextEncoder(), dec=new TextDecoder();
 function b64(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s)}
 function un64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
 async function sha(bytes){return new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))}
 async function hex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
 async function derive(mail,pw){
  const salt=await sha(enc.encode('FOSS-myTIME-cloud-v1:'+mail));
  const material=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveBits']);
  const bits=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},material,256));
  const key=await crypto.subtle.importKey('raw',bits,{name:'AES-GCM'},false,['encrypt','decrypt']);
  const verifier=await hex(await sha(new Uint8Array([...bits,...enc.encode('|myTIME-verifier-v1')])));
  const account=await hex(await sha(enc.encode('myTIME-account-v1:'+mail)));
  bits.fill(0);
  return {key,verifier,account};
 }
 async function encryptPayload(obj,key){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const plain=enc.encode(JSON.stringify(obj));
  const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain));
  return JSON.stringify({v:1,iv:b64(iv),cipher:b64(cipher)});
 }
 async function decryptPayload(value,key){
  const box=JSON.parse(value);if(box.v!==1||!box.iv||!box.cipher)throw Error('Unsupported cloud backup format');
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(box.iv)},key,un64(box.cipher));
  return JSON.parse(dec.decode(plain));
 }
 function localBackup(){return {app:'FOSS myTIME',version:3,exportedAt:new Date().toISOString(),settings,data,bankEntries,profile:typeof profile!=='undefined'?profile:null,theme:localStorage.getItem('foss-time-theme-v1')||'light'}}
 async function request(url,options){const r=await fetch(url,{...options,mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json',...(options?.headers||{})}});let j={};try{j=await r.json()}catch{}if(!r.ok){if(j.error==='account_locked')throw Error('This cloud profile is locked with a different passphrase. Check the email and passphrase, or use the passphrase that originally created it.');throw Error(j.message||j.error||('Cloud service returned HTTP '+r.status))}return j}
 async function fetchRemote(){remoteMeta=await request(API+'?account='+encodeURIComponent(session.account),{method:'GET'});setButtons();return remoteMeta}
 async function upload(silent=false){
  if(!session||busy)return;busy=true;setButtons();
  try{
   const currentBackup=localBackup();
   if(!Object.keys(currentBackup.data||{}).length&&!(Array.isArray(currentBackup.bankEntries)&&currentBackup.bankEntries.length))throw Error('This browser has no time records or time-bank entries to back up. To protect existing records, empty data will not be uploaded. Restore a cloud/JSON backup first, or create records on this device.');
   const payload=await encryptPayload(currentBackup,session.key);
   const result=await request(API,{method:'PUT',body:JSON.stringify({account:session.account,verifier:session.verifier,ciphertext:payload})});
   remoteMeta={exists:true,updatedAt:result.updatedAt,revision:result.revision,verifier:session.verifier};
   updated.textContent='Last cloud backup: '+new Date(result.updatedAt).toLocaleString()+' · revision '+result.revision;
   setStatus(silent?'Changes backed up securely to your cloud profile.':'Cloud backup completed successfully.','success');
  }catch(e){setStatus('Cloud backup failed: '+e.message,'error')}finally{busy=false;setButtons()}
 }
 async function connect(){
  const mail=email.value.trim().toLowerCase(),pw=pass.value;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)){setStatus('Enter a valid email address.','error');return}
  if(pw.length<14){setStatus('Use a unique passphrase of at least 14 characters.','error');return}
  if(!crypto.subtle){setStatus('Secure encryption is unavailable in this browser. Open the HTTPS myTIME site.','error');return}
  busy=true;setButtons();setStatus('Deriving encryption key and checking cloud profile…');
  try{
   const derived=await derive(mail,pw);
   const previous=await request(API+'?account='+encodeURIComponent(derived.account),{method:'GET'});
   if(previous.exists&&previous.verifier!==derived.verifier){setStatus('Passphrase does not unlock this cloud profile. No data was changed.','error');return}
   session={email:mail,...derived};remoteMeta=previous;
   if(previous.exists){
    updated.textContent='Cloud backup found · last saved '+new Date(previous.updatedAt).toLocaleString();
    const localHasRecords=Object.values(data||{}).some(r=>r&&Array.isArray(r.punches)&&r.punches.length)||Array.isArray(bankEntries)&&bankEntries.length>0;
    if(!localHasRecords){
     setStatus('Cloud backup found. Restoring it to this device…');
     const cloudData=await decryptPayload(previous.ciphertext,session.key);
     if(!cloudData.data||typeof cloudData.data!=='object')throw Error('Cloud backup has no valid time records.');
     data=cloudData.data;if(cloudData.settings)settings=cloudData.settings;
     localStorage.setItem(KEY,JSON.stringify(data));localStorage.setItem(SETKEY,JSON.stringify(settings));
     if(Array.isArray(cloudData.bankEntries)){bankEntries=cloudData.bankEntries;localStorage.setItem(BANKKEY,JSON.stringify(bankEntries))}
     if(cloudData.profile&&typeof cloudData.profile==='object'){profile={name:String(cloudData.profile.name||''),email:String(cloudData.profile.email||''),photo:String(cloudData.profile.photo||'')};localStorage.setItem('foss-time-profile-v1',JSON.stringify(profile));if(typeof renderProfile==='function')renderProfile()}
     if(cloudData.theme==='dark'||cloudData.theme==='light')localStorage.setItem('foss-time-theme-v1',cloudData.theme);
     applySettings();render();
     setStatus('Cloud records restored automatically on this device. Verify your timesheet.','success');
    }else{
     setStatus('Cloud profile unlocked. This device already has records, so nothing was overwritten. Choose Restore from cloud to replace them, or Back up now only if you intend to replace the cloud copy.','success');
    }
   }else{
    updated.textContent='No cloud backup exists yet for this profile.';
    setStatus('Cloud profile connected. Creating your first encrypted backup now…');
   }
   pass.value='';
  }catch(e){setStatus('Could not connect: '+e.message,'error')}finally{busy=false;setButtons()}
  if(session&&!remoteMeta?.exists){const hasLocal=Object.values(data||{}).some(r=>r&&Array.isArray(r.punches)&&r.punches.length)||Array.isArray(bankEntries)&&bankEntries.length>0;if(hasLocal)await upload(true);else setStatus('Cloud profile connected. No local time records found yet; your first backup will be created when you save records.','info')}
 }
 async function restoreRemote(){
  if(!session||busy||!remoteMeta?.exists)return;
  if(!confirm('Restore the encrypted cloud backup to this browser? This replaces current local time records, settings, and time-bank entries. Export a local backup first if you need the current records.'))return;
  busy=true;setButtons();setStatus('Downloading and decrypting cloud backup…');
  try{
   const remote=await request(API+'?account='+encodeURIComponent(session.account),{method:'GET'});
   if(!remote.exists)throw Error('No cloud backup was found.');
   if(remote.verifier!==session.verifier)throw Error('Cloud passphrase verification failed.');
   const obj=await decryptPayload(remote.ciphertext,session.key);
   if(!obj.data||typeof obj.data!=='object')throw Error('Backup file has no valid time records.');
   data=obj.data;if(obj.settings)settings=obj.settings;
   if(Array.isArray(obj.bankEntries)){bankEntries=obj.bankEntries;localStorage.setItem(BANKKEY,JSON.stringify(bankEntries))}
   if(obj.profile&&typeof obj.profile==='object'){profile={name:String(obj.profile.name||''),email:String(obj.profile.email||''),photo:String(obj.profile.photo||'')};localStorage.setItem('foss-time-profile-v1',JSON.stringify(profile));if(typeof renderProfile==='function')renderProfile()}
   save();saveSet();if(obj.theme==='dark'||obj.theme==='light')localStorage.setItem('foss-time-theme-v1',obj.theme);
   applySettings();render();remoteMeta=remote;updated.textContent='Restored cloud backup saved '+new Date(remote.updatedAt).toLocaleString();
   setStatus('Cloud backup restored to this browser. Verify your timesheet and export a safety copy.','success');
  }catch(e){setStatus('Restore failed: '+e.message,'error')}finally{busy=false;setButtons()}
 }
 unlock.addEventListener('click',connect);
 backup.addEventListener('click',()=>{if(remoteMeta?.exists&&!confirm('Replace the current cloud backup with this browser’s current records?'))return;upload(false)});
 restore.addEventListener('click',restoreRemote);
 lock.addEventListener('click',()=>{session=null;remoteMeta=null;pass.value='';clearTimeout(timer);setButtons();setStorageBadge('Local-only storage','Cloud profile is locked. Records remain on this device.','info');setStatus('Cloud profile locked. Records on this device are unchanged.')});
 email.value=(typeof profile!=='undefined'&&profile.email)||'';
 // While unlocked, changes made through the app are backed up after a short idle period.
 const priorSave=save;save=function(){const result=priorSave();if(session){clearTimeout(timer);timer=setTimeout(()=>upload(true),1800)}return result};
 const priorSaveSet=saveSet;saveSet=function(){const result=priorSaveSet();if(session){clearTimeout(timer);timer=setTimeout(()=>upload(true),1800)}return result};
 setButtons();
})();
