import{W as Mt}from"./index-BNmZqAEh.js";/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Bt=()=>{};var Ee={};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const We=function(e){const t=[];let n=0;for(let r=0;r<e.length;r++){let i=e.charCodeAt(r);i<128?t[n++]=i:i<2048?(t[n++]=i>>6|192,t[n++]=i&63|128):(i&64512)===55296&&r+1<e.length&&(e.charCodeAt(r+1)&64512)===56320?(i=65536+((i&1023)<<10)+(e.charCodeAt(++r)&1023),t[n++]=i>>18|240,t[n++]=i>>12&63|128,t[n++]=i>>6&63|128,t[n++]=i&63|128):(t[n++]=i>>12|224,t[n++]=i>>6&63|128,t[n++]=i&63|128)}return t},Pt=function(e){const t=[];let n=0,r=0;for(;n<e.length;){const i=e[n++];if(i<128)t[r++]=String.fromCharCode(i);else if(i>191&&i<224){const o=e[n++];t[r++]=String.fromCharCode((i&31)<<6|o&63)}else if(i>239&&i<365){const o=e[n++],a=e[n++],c=e[n++],d=((i&7)<<18|(o&63)<<12|(a&63)<<6|c&63)-65536;t[r++]=String.fromCharCode(55296+(d>>10)),t[r++]=String.fromCharCode(56320+(d&1023))}else{const o=e[n++],a=e[n++];t[r++]=String.fromCharCode((i&15)<<12|(o&63)<<6|a&63)}}return t.join("")},qe={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(e,t){if(!Array.isArray(e))throw Error("encodeByteArray takes an array as a parameter");this.init_();const n=t?this.byteToCharMapWebSafe_:this.byteToCharMap_,r=[];for(let i=0;i<e.length;i+=3){const o=e[i],a=i+1<e.length,c=a?e[i+1]:0,d=i+2<e.length,s=d?e[i+2]:0,$=o>>2,N=(o&3)<<4|c>>4;let L=(c&15)<<2|s>>6,H=s&63;d||(H=64,a||(L=64)),r.push(n[$],n[N],n[L],n[H])}return r.join("")},encodeString(e,t){return this.HAS_NATIVE_SUPPORT&&!t?btoa(e):this.encodeByteArray(We(e),t)},decodeString(e,t){return this.HAS_NATIVE_SUPPORT&&!t?atob(e):Pt(this.decodeStringToByteArray(e,t))},decodeStringToByteArray(e,t){this.init_();const n=t?this.charToByteMapWebSafe_:this.charToByteMap_,r=[];for(let i=0;i<e.length;){const o=n[e.charAt(i++)],c=i<e.length?n[e.charAt(i)]:0;++i;const s=i<e.length?n[e.charAt(i)]:64;++i;const N=i<e.length?n[e.charAt(i)]:64;if(++i,o==null||c==null||s==null||N==null)throw new Ft;const L=o<<2|c>>4;if(r.push(L),s!==64){const H=c<<4&240|s>>2;if(r.push(H),N!==64){const Ot=s<<6&192|N;r.push(Ot)}}}return r},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let e=0;e<this.ENCODED_VALS.length;e++)this.byteToCharMap_[e]=this.ENCODED_VALS.charAt(e),this.charToByteMap_[this.byteToCharMap_[e]]=e,this.byteToCharMapWebSafe_[e]=this.ENCODED_VALS_WEBSAFE.charAt(e),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[e]]=e,e>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(e)]=e,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(e)]=e)}}};class Ft extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const $t=function(e){const t=We(e);return qe.encodeByteArray(t,!0)},ze=function(e){return $t(e).replace(/\./g,"")},Lt=function(e){try{return qe.decodeString(e,!0)}catch(t){console.error("base64Decode failed: ",t)}return null};/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ht(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const xt=()=>Ht().__FIREBASE_DEFAULTS__,jt=()=>{if(typeof process>"u"||typeof Ee>"u")return;const e=Ee.__FIREBASE_DEFAULTS__;if(e)return JSON.parse(e)},Vt=()=>{if(typeof document>"u")return;let e;try{e=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const t=e&&Lt(e[1]);return t&&JSON.parse(t)},Ut=()=>{try{return Bt()||xt()||jt()||Vt()}catch(e){`${e}`;return}},Ge=()=>{var e;return(e=Ut())==null?void 0:e.config};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Kt{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((t,n)=>{this.resolve=t,this.reject=n})}wrapCallback(t){return(n,r)=>{n?this.reject(n):this.resolve(r),typeof t=="function"&&(this.promise.catch(()=>{}),t.length===1?t(n):t(n,r))}}}function Je(){try{return typeof indexedDB=="object"}catch{return!1}}function Ye(){return new Promise((e,t)=>{try{let n=!0;const r="validate-browser-context-for-indexeddb-analytics-module",i=self.indexedDB.open(r);i.onsuccess=()=>{i.result.close(),n||self.indexedDB.deleteDatabase(r),e(!0)},i.onupgradeneeded=()=>{n=!1},i.onerror=()=>{var o;t(((o=i.error)==null?void 0:o.message)||"")}}catch(n){t(n)}})}function Wt(){return!(typeof navigator>"u"||!navigator.cookieEnabled)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const qt="FirebaseError";class D extends Error{constructor(t,n,r){super(n),this.code=t,this.customData=r,this.name=qt,Object.setPrototypeOf(this,D.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,U.prototype.create)}}class U{constructor(t,n,r){this.service=t,this.serviceName=n,this.errors=r}create(t,...n){const r=n[0]||{},i=`${this.service}/${t}`,o=this.errors[t],a=o?zt(o,r):"Error",c=`${this.serviceName}: ${a} (${i}).`;return new D(i,c,r)}}function zt(e,t){try{let n=0,r="";for(;n<e.length;){const i=e.indexOf("{$",n);if(i===-1){r+=e.substring(n);break}const o=e.indexOf("}",i+2);if(o===-1){r+=e.substring(n);break}const a=e.substring(i+2,o),c=t[a];r+=e.substring(n,i)+(c!=null?String(c):`<${a}?>`),n=o+1}return r}catch{return e}}function ne(e,t){if(e===t)return!0;const n=Object.keys(e),r=Object.keys(t);for(const i of n){if(!r.includes(i))return!1;const o=e[i],a=t[i];if(Se(o)&&Se(a)){if(!ne(o,a))return!1}else if(o!==a)return!1}for(const i of r)if(!n.includes(i))return!1;return!0}function Se(e){return e!==null&&typeof e=="object"}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function K(e){return e&&e._delegate?e._delegate:e}class w{constructor(t,n,r){this.name=t,this.instanceFactory=n,this.type=r,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(t){return this.instantiationMode=t,this}setMultipleInstances(t){return this.multipleInstances=t,this}setServiceProps(t){return this.serviceProps=t,this}setInstanceCreatedCallback(t){return this.onInstanceCreated=t,this}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const y="[DEFAULT]";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Gt{constructor(t,n){this.name=t,this.container=n,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(t){const n=this.normalizeInstanceIdentifier(t);if(!this.instancesDeferred.has(n)){const r=new Kt;if(this.instancesDeferred.set(n,r),this.isInitialized(n)||this.shouldAutoInitialize())try{const i=this.getOrInitializeService({instanceIdentifier:n});i&&r.resolve(i)}catch{}}return this.instancesDeferred.get(n).promise}getImmediate(t){const n=this.normalizeInstanceIdentifier(t==null?void 0:t.identifier),r=(t==null?void 0:t.optional)??!1;if(this.isInitialized(n)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:n})}catch(i){if(r)return null;throw i}else{if(r)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(t){if(t.name!==this.name)throw Error(`Mismatching Component ${t.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=t,!!this.shouldAutoInitialize()){if(Yt(t))try{this.getOrInitializeService({instanceIdentifier:y})}catch{}for(const[n,r]of this.instancesDeferred.entries()){const i=this.normalizeInstanceIdentifier(n);try{const o=this.getOrInitializeService({instanceIdentifier:i});r.resolve(o)}catch{}}}}clearInstance(t=y){this.instancesDeferred.delete(t),this.instancesOptions.delete(t),this.instances.delete(t)}async delete(){const t=Array.from(this.instances.values());await Promise.all([...t.filter(n=>"INTERNAL"in n).map(n=>n.INTERNAL.delete()),...t.filter(n=>"_delete"in n).map(n=>n._delete())])}isComponentSet(){return this.component!=null}isInitialized(t=y){return this.instances.has(t)}getOptions(t=y){return this.instancesOptions.get(t)||{}}initialize(t={}){const{options:n={}}=t,r=this.normalizeInstanceIdentifier(t.instanceIdentifier);if(this.isInitialized(r))throw Error(`${this.name}(${r}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const i=this.getOrInitializeService({instanceIdentifier:r,options:n});for(const[o,a]of this.instancesDeferred.entries()){const c=this.normalizeInstanceIdentifier(o);r===c&&a.resolve(i)}return i}onInit(t,n){const r=this.normalizeInstanceIdentifier(n),i=this.onInitCallbacks.get(r)??new Set;i.add(t),this.onInitCallbacks.set(r,i);const o=this.instances.get(r);return o&&t(o,r),()=>{i.delete(t)}}invokeOnInitCallbacks(t,n){const r=this.onInitCallbacks.get(n);if(r)for(const i of r)try{i(t,n)}catch{}}getOrInitializeService({instanceIdentifier:t,options:n={}}){let r=this.instances.get(t);if(!r&&this.component&&(r=this.component.instanceFactory(this.container,{instanceIdentifier:Jt(t),options:n}),this.instances.set(t,r),this.instancesOptions.set(t,n),this.invokeOnInitCallbacks(r,t),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,t,r)}catch{}return r||null}normalizeInstanceIdentifier(t=y){return this.component?this.component.multipleInstances?t:y:t}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function Jt(e){return e===y?void 0:e}function Yt(e){return e.instantiationMode==="EAGER"}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Xt{constructor(t){this.name=t,this.providers=new Map}addComponent(t){const n=this.getProvider(t.name);if(n.isComponentSet())throw new Error(`Component ${t.name} has already been registered with ${this.name}`);n.setComponent(t)}addOrOverwriteComponent(t){this.getProvider(t.name).isComponentSet()&&this.providers.delete(t.name),this.addComponent(t)}getProvider(t){if(this.providers.has(t))return this.providers.get(t);const n=new Gt(t,this);return this.providers.set(t,n),n}getProviders(){return Array.from(this.providers.values())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var f;(function(e){e[e.DEBUG=0]="DEBUG",e[e.VERBOSE=1]="VERBOSE",e[e.INFO=2]="INFO",e[e.WARN=3]="WARN",e[e.ERROR=4]="ERROR",e[e.SILENT=5]="SILENT"})(f||(f={}));const Qt={debug:f.DEBUG,verbose:f.VERBOSE,info:f.INFO,warn:f.WARN,error:f.ERROR,silent:f.SILENT},Zt=f.INFO,en={[f.DEBUG]:"log",[f.VERBOSE]:"log",[f.INFO]:"info",[f.WARN]:"warn",[f.ERROR]:"error"},tn=(e,t,...n)=>{if(t<e.logLevel)return;const r=new Date().toISOString(),i=en[t];if(i)console[i](`[${r}]  ${e.name}:`,...n);else throw new Error(`Attempted to log a message with an invalid logType (value: ${t})`)};class nn{constructor(t){this.name=t,this._logLevel=Zt,this._logHandler=tn,this._userLogHandler=null}get logLevel(){return this._logLevel}set logLevel(t){if(!(t in f))throw new TypeError(`Invalid value "${t}" assigned to \`logLevel\``);this._logLevel=t}setLogLevel(t){this._logLevel=typeof t=="string"?Qt[t]:t}get logHandler(){return this._logHandler}set logHandler(t){if(typeof t!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=t}get userLogHandler(){return this._userLogHandler}set userLogHandler(t){this._userLogHandler=t}debug(...t){this._userLogHandler&&this._userLogHandler(this,f.DEBUG,...t),this._logHandler(this,f.DEBUG,...t)}log(...t){this._userLogHandler&&this._userLogHandler(this,f.VERBOSE,...t),this._logHandler(this,f.VERBOSE,...t)}info(...t){this._userLogHandler&&this._userLogHandler(this,f.INFO,...t),this._logHandler(this,f.INFO,...t)}warn(...t){this._userLogHandler&&this._userLogHandler(this,f.WARN,...t),this._logHandler(this,f.WARN,...t)}error(...t){this._userLogHandler&&this._userLogHandler(this,f.ERROR,...t),this._logHandler(this,f.ERROR,...t)}}const rn=(e,t)=>t.some(n=>e instanceof n);let _e,Te;function on(){return _e||(_e=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function an(){return Te||(Te=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const Xe=new WeakMap,re=new WeakMap,Qe=new WeakMap,z=new WeakMap,ue=new WeakMap;function sn(e){const t=new Promise((n,r)=>{const i=()=>{e.removeEventListener("success",o),e.removeEventListener("error",a)},o=()=>{n(g(e.result)),i()},a=()=>{r(e.error),i()};e.addEventListener("success",o),e.addEventListener("error",a)});return t.then(n=>{n instanceof IDBCursor&&Xe.set(n,e)}).catch(()=>{}),ue.set(t,e),t}function cn(e){if(re.has(e))return;const t=new Promise((n,r)=>{const i=()=>{e.removeEventListener("complete",o),e.removeEventListener("error",a),e.removeEventListener("abort",a)},o=()=>{n(),i()},a=()=>{r(e.error||new DOMException("AbortError","AbortError")),i()};e.addEventListener("complete",o),e.addEventListener("error",a),e.addEventListener("abort",a)});re.set(e,t)}let ie={get(e,t,n){if(e instanceof IDBTransaction){if(t==="done")return re.get(e);if(t==="objectStoreNames")return e.objectStoreNames||Qe.get(e);if(t==="store")return n.objectStoreNames[1]?void 0:n.objectStore(n.objectStoreNames[0])}return g(e[t])},set(e,t,n){return e[t]=n,!0},has(e,t){return e instanceof IDBTransaction&&(t==="done"||t==="store")?!0:t in e}};function dn(e){ie=e(ie)}function un(e){return e===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(t,...n){const r=e.call(G(this),t,...n);return Qe.set(r,t.sort?t.sort():[t]),g(r)}:an().includes(e)?function(...t){return e.apply(G(this),t),g(Xe.get(this))}:function(...t){return g(e.apply(G(this),t))}}function fn(e){return typeof e=="function"?un(e):(e instanceof IDBTransaction&&cn(e),rn(e,on())?new Proxy(e,ie):e)}function g(e){if(e instanceof IDBRequest)return sn(e);if(z.has(e))return z.get(e);const t=fn(e);return t!==e&&(z.set(e,t),ue.set(t,e)),t}const G=e=>ue.get(e);function W(e,t,{blocked:n,upgrade:r,blocking:i,terminated:o}={}){const a=indexedDB.open(e,t),c=g(a);return r&&a.addEventListener("upgradeneeded",d=>{r(g(a.result),d.oldVersion,d.newVersion,g(a.transaction),d)}),n&&a.addEventListener("blocked",d=>n(d.oldVersion,d.newVersion,d)),c.then(d=>{o&&d.addEventListener("close",()=>o()),i&&d.addEventListener("versionchange",s=>i(s.oldVersion,s.newVersion,s))}).catch(()=>{}),c}function x(e,{blocked:t}={}){const n=indexedDB.deleteDatabase(e);return t&&n.addEventListener("blocked",r=>t(r.oldVersion,r)),g(n).then(()=>{})}const ln=["get","getKey","getAll","getAllKeys","count"],hn=["put","add","delete","clear"],J=new Map;function ve(e,t){if(!(e instanceof IDBDatabase&&!(t in e)&&typeof t=="string"))return;if(J.get(t))return J.get(t);const n=t.replace(/FromIndex$/,""),r=t!==n,i=hn.includes(n);if(!(n in(r?IDBIndex:IDBObjectStore).prototype)||!(i||ln.includes(n)))return;const o=async function(a,...c){const d=this.transaction(a,i?"readwrite":"readonly");let s=d.store;return r&&(s=s.index(c.shift())),(await Promise.all([s[n](...c),i&&d.done]))[0]};return J.set(t,o),o}dn(e=>({...e,get:(t,n,r)=>ve(t,n)||e.get(t,n,r),has:(t,n)=>!!ve(t,n)||e.has(t,n)}));/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class pn{constructor(t){this.container=t}getPlatformInfoString(){return this.container.getProviders().map(n=>{if(gn(n)){const r=n.getImmediate();return`${r.library}/${r.version}`}else return null}).filter(n=>n).join(" ")}}function gn(e){const t=e.getComponent();return(t==null?void 0:t.type)==="VERSION"}const oe="@firebase/app",Ae="0.16.2";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const b=new nn("@firebase/app"),bn="@firebase/app-compat",mn="@firebase/analytics-compat",wn="@firebase/analytics",yn="@firebase/app-check-compat",In="@firebase/app-check",En="@firebase/auth",Sn="@firebase/auth-compat",_n="@firebase/database",Tn="@firebase/data-connect",vn="@firebase/database-compat",An="@firebase/functions",Dn="@firebase/functions-compat",Cn="@firebase/installations",kn="@firebase/installations-compat",Rn="@firebase/messaging",Nn="@firebase/messaging-compat",On="@firebase/performance",Mn="@firebase/performance-compat",Bn="@firebase/remote-config",Pn="@firebase/remote-config-compat",Fn="@firebase/storage",$n="@firebase/storage-compat",Ln="@firebase/firestore",Hn="@firebase/ai",xn="@firebase/firestore-compat",jn="firebase";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ae="[DEFAULT]",Vn={[oe]:"fire-core",[bn]:"fire-core-compat",[wn]:"fire-analytics",[mn]:"fire-analytics-compat",[In]:"fire-app-check",[yn]:"fire-app-check-compat",[En]:"fire-auth",[Sn]:"fire-auth-compat",[_n]:"fire-rtdb",[Tn]:"fire-data-connect",[vn]:"fire-rtdb-compat",[An]:"fire-fn",[Dn]:"fire-fn-compat",[Cn]:"fire-iid",[kn]:"fire-iid-compat",[Rn]:"fire-fcm",[Nn]:"fire-fcm-compat",[On]:"fire-perf",[Mn]:"fire-perf-compat",[Bn]:"fire-rc",[Pn]:"fire-rc-compat",[Fn]:"fire-gcs",[$n]:"fire-gcs-compat",[Ln]:"fire-fst",[xn]:"fire-fst-compat",[Hn]:"fire-vertex","fire-js":"fire-js",[jn]:"fire-js-all"};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const j=new Map,Un=new Map,se=new Map;function De(e,t){try{e.container.addComponent(t)}catch(n){b.debug(`Component ${t.name} failed to register with FirebaseApp ${e.name}`,n)}}function S(e){const t=e.name;if(se.has(t))return b.debug(`There were multiple attempts to register component ${t}.`),!1;se.set(t,e);for(const n of j.values())De(n,e);for(const n of Un.values())De(n,e);return!0}function fe(e,t){const n=e.container.getProvider("heartbeat").getImmediate({optional:!0});return n&&n.triggerHeartbeat(),e.container.getProvider(t)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Kn={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different {$mismatchedParam}. Existing: '{$oldValue}'. New: '{$newValue}'.","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},p=new U("app","Firebase",Kn);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Wn{constructor(t,n,r){this._isDeleted=!1,this._options={...t},this._config={...n},this._name=n.name,this._automaticDataCollectionEnabled=n.automaticDataCollectionEnabled,this._container=r,this.container.addComponent(new w("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(t){this.checkDestroyed(),this._automaticDataCollectionEnabled=t}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(t){this._isDeleted=t}checkDestroyed(){if(this.isDeleted)throw p.create("app-deleted",{appName:this._name})}}function qn(e,t={}){let n=e;typeof t!="object"&&(t={name:t});const r={name:ae,automaticDataCollectionEnabled:!0,...t},i=r.name;if(typeof i!="string"||!i)throw p.create("bad-app-name",{appName:String(i)});if(n||(n=Ge()),!n)throw p.create("no-options");const o=j.get(i);if(o)if(ne(n,o.options)){if(ne(r,o.config))return o;throw p.create("duplicate-app",{appName:i,mismatchedParam:"config",oldValue:JSON.stringify(o.config),newValue:JSON.stringify(r)})}else throw p.create("duplicate-app",{appName:i,mismatchedParam:"options",oldValue:JSON.stringify(o.options),newValue:JSON.stringify(n)});const a=new Xt(i);for(const d of se.values())a.addComponent(d);const c=new Wn(n,r,a);return j.set(i,c),c}function zn(e=ae){const t=j.get(e);if(!t&&e===ae&&Ge())return qn();if(!t)throw p.create("no-app",{appName:e});return t}function E(e,t,n){let r=Vn[e]??e;n&&(r+=`-${n}`);const i=r.match(/\s|\//),o=t.match(/\s|\//);if(i||o){const a=[`Unable to register library "${r}" with version "${t}":`];i&&a.push(`library name "${r}" contains illegal characters (whitespace or "/")`),i&&o&&a.push("and"),o&&a.push(`version name "${t}" contains illegal characters (whitespace or "/")`),b.warn(a.join(" "));return}S(new w(`${r}-version`,()=>({library:r,version:t}),"VERSION"))}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Gn="firebase-heartbeat-database",Jn=1,B="firebase-heartbeat-store";let Y=null;function Ze(){return Y||(Y=W(Gn,Jn,{upgrade:(e,t)=>{switch(t){case 0:try{e.createObjectStore(B)}catch(n){}}}}).catch(e=>{throw p.create("idb-open",{originalErrorMessage:e.message})})),Y}async function Yn(e){try{const n=(await Ze()).transaction(B),r=await n.objectStore(B).get(et(e));return await n.done,r}catch(t){if(t instanceof D)b.warn(t.message);else{const n=p.create("idb-get",{originalErrorMessage:t==null?void 0:t.message});b.warn(n.message)}}}async function Ce(e,t){try{const r=(await Ze()).transaction(B,"readwrite");await r.objectStore(B).put(t,et(e)),await r.done}catch(n){if(n instanceof D)b.warn(n.message);else{const r=p.create("idb-set",{originalErrorMessage:n==null?void 0:n.message});b.warn(r.message)}}}function et(e){return`${e.name}!${e.options.appId}`}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Xn=1024,Qn=30;class Zn{constructor(t){this.container=t,this._heartbeatsCache=null;const n=this.container.getProvider("app").getImmediate();this._storage=new tr(n),this._heartbeatsCachePromise=this._storage.read().then(r=>(this._heartbeatsCache=r,r))}async triggerHeartbeat(){var t,n;try{const i=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),o=ke();if(((t=this._heartbeatsCache)==null?void 0:t.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((n=this._heartbeatsCache)==null?void 0:n.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===o||this._heartbeatsCache.heartbeats.some(a=>a.date===o))return;if(this._heartbeatsCache.heartbeats.push({date:o,agent:i}),this._heartbeatsCache.heartbeats.length>Qn){const a=nr(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(a,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(r){b.warn(r)}}async getHeartbeatsHeader(){var t;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((t=this._heartbeatsCache)==null?void 0:t.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";const n=ke(),{heartbeatsToSend:r,unsentEntries:i}=er(this._heartbeatsCache.heartbeats),o=ze(JSON.stringify({version:2,heartbeats:r}));return this._heartbeatsCache.lastSentHeartbeatDate=n,i.length>0?(this._heartbeatsCache.heartbeats=i,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),o}catch(n){return b.warn(n),""}}}function ke(){return new Date().toISOString().substring(0,10)}function er(e,t=Xn){const n=[];let r=e.slice();for(const i of e){const o=n.find(a=>a.agent===i.agent);if(o){if(o.dates.push(i.date),Re(n)>t){o.dates.pop();break}}else if(n.push({agent:i.agent,dates:[i.date]}),Re(n)>t){n.pop();break}r=r.slice(1)}return{heartbeatsToSend:n,unsentEntries:r}}class tr{constructor(t){this.app=t,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return Je()?Ye().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const n=await Yn(this.app);return n!=null&&n.heartbeats?n:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(t){if(await this._canUseIndexedDBPromise){const r=await this.read();return Ce(this.app,{lastSentHeartbeatDate:t.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:t.heartbeats})}else return}async add(t){if(await this._canUseIndexedDBPromise){const r=await this.read();return Ce(this.app,{lastSentHeartbeatDate:t.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:[...r.heartbeats,...t.heartbeats]})}else return}}function Re(e){return ze(JSON.stringify({version:2,heartbeats:e})).length}function nr(e){if(e.length===0)return-1;let t=0,n=e[0].date;for(let r=1;r<e.length;r++)e[r].date<n&&(n=e[r].date,t=r);return t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function rr(e){S(new w("platform-logger",t=>new pn(t),"PRIVATE")),S(new w("heartbeat",t=>new Zn(t),"PRIVATE")),E(oe,Ae,e),E(oe,Ae,"esm2020"),E("fire-js","")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */rr("");const tt="@firebase/installations",le="0.6.24";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const nt=1e4,rt=`w:${le}`,it="FIS_v2",ir="https://firebaseinstallations.googleapis.com/v1",or=60*60*1e3,ar="installations",sr="Installations";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const cr={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":"Firebase Installation is not registered.","installation-not-found":"Firebase Installation not found.","request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":"Could not process request. Application offline.","delete-pending-registration":"Can't delete installation while there is a pending registration request."},_=new U(ar,sr,cr);function ot(e){return e instanceof D&&e.code.includes("request-failed")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function at({projectId:e}){return`${ir}/projects/${e}/installations`}function st(e){return{token:e.token,requestStatus:2,expiresIn:ur(e.expiresIn),creationTime:Date.now()}}async function ct(e,t){const r=(await t.json()).error;return _.create("request-failed",{requestName:e,serverCode:r.code,serverMessage:r.message,serverStatus:r.status})}function dt({apiKey:e}){return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e})}function dr(e,{refreshToken:t}){const n=dt(e);return n.append("Authorization",fr(t)),n}async function ut(e){const t=await e();return t.status>=500&&t.status<600?e():t}function ur(e){return Number(e.replace("s","000"))}function fr(e){return`${it} ${e}`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function lr({appConfig:e,heartbeatServiceProvider:t},{fid:n}){const r=at(e),i=dt(e),o=t.getImmediate({optional:!0});if(o){const s=await o.getHeartbeatsHeader();s&&i.append("x-firebase-client",s)}const a={fid:n,authVersion:it,appId:e.appId,sdkVersion:rt},c={method:"POST",headers:i,body:JSON.stringify(a)},d=await ut(()=>fetch(r,c));if(d.ok){const s=await d.json();return{fid:s.fid||n,registrationStatus:2,refreshToken:s.refreshToken,authToken:st(s.authToken)}}else throw await ct("Create Installation",d)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ft(e){return new Promise(t=>{setTimeout(t,e)})}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function hr(e){return btoa(String.fromCharCode(...e)).replace(/\+/g,"-").replace(/\//g,"_")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const pr=/^[cdef][\w-]{21}$/,ce="";function gr(){try{const e=new Uint8Array(17);(self.crypto||self.msCrypto).getRandomValues(e),e[0]=112+e[0]%16;const n=br(e);return pr.test(n)?n:ce}catch{return ce}}function br(e){return hr(e).substr(0,22)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function C(e){return`${e.appName}!${e.appId}`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const v=new Map;function lt(e,t){const n=C(e);ht(n,t),yr(n,t)}function mr(e,t){pt();const n=C(e);let r=v.get(n);r||(r=new Set,v.set(n,r)),r.add(t)}function wr(e,t){const n=C(e),r=v.get(n);r&&(r.delete(t),r.size===0&&v.delete(n),gt())}function ht(e,t){const n=v.get(e);if(n)for(const r of n)r(t)}function yr(e,t){const n=pt();n&&n.postMessage({key:e,fid:t}),gt()}let I=null;function pt(){return!I&&"BroadcastChannel"in self&&(I=new BroadcastChannel("[Firebase] FID Change"),I.onmessage=e=>{ht(e.data.key,e.data.fid)}),I}function gt(){v.size===0&&I&&(I.close(),I=null)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ir="firebase-installations-database",Er=1,T="firebase-installations-store";let X=null;function he(){return X||(X=W(Ir,Er,{upgrade:(e,t)=>{switch(t){case 0:e.createObjectStore(T)}}})),X}async function V(e,t){const n=C(e),i=(await he()).transaction(T,"readwrite"),o=i.objectStore(T),a=await o.get(n);return await o.put(t,n),await i.done,(!a||a.fid!==t.fid)&&lt(e,t.fid),t}async function bt(e){const t=C(e),r=(await he()).transaction(T,"readwrite");await r.objectStore(T).delete(t),await r.done}async function q(e,t){const n=C(e),i=(await he()).transaction(T,"readwrite"),o=i.objectStore(T),a=await o.get(n),c=t(a);return c===void 0?await o.delete(n):await o.put(c,n),await i.done,c&&(!a||a.fid!==c.fid)&&lt(e,c.fid),c}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function pe(e){let t;const n=await q(e.appConfig,r=>{const i=Sr(r),o=_r(e,i);return t=o.registrationPromise,o.installationEntry});return n.fid===ce?{installationEntry:await t}:{installationEntry:n,registrationPromise:t}}function Sr(e){const t=e||{fid:gr(),registrationStatus:0};return mt(t)}function _r(e,t){if(t.registrationStatus===0){if(!navigator.onLine){const i=Promise.reject(_.create("app-offline"));return{installationEntry:t,registrationPromise:i}}const n={fid:t.fid,registrationStatus:1,registrationTime:Date.now()},r=Tr(e,n);return{installationEntry:n,registrationPromise:r}}else return t.registrationStatus===1?{installationEntry:t,registrationPromise:vr(e)}:{installationEntry:t}}async function Tr(e,t){try{const n=await lr(e,t);return V(e.appConfig,n)}catch(n){throw ot(n)&&n.customData.serverCode===409?await bt(e.appConfig):await V(e.appConfig,{fid:t.fid,registrationStatus:0}),n}}async function vr(e){let t=await Ne(e.appConfig);for(;t.registrationStatus===1;)await ft(100),t=await Ne(e.appConfig);if(t.registrationStatus===0){const{installationEntry:n,registrationPromise:r}=await pe(e);return r||n}return t}function Ne(e){return q(e,t=>{if(!t)throw _.create("installation-not-found");return mt(t)})}function mt(e){return Ar(e)?{fid:e.fid,registrationStatus:0}:e}function Ar(e){return e.registrationStatus===1&&e.registrationTime+nt<Date.now()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Dr({appConfig:e,heartbeatServiceProvider:t},n){const r=Cr(e,n),i=dr(e,n),o=t.getImmediate({optional:!0});if(o){const s=await o.getHeartbeatsHeader();s&&i.append("x-firebase-client",s)}const a={installation:{sdkVersion:rt,appId:e.appId}},c={method:"POST",headers:i,body:JSON.stringify(a)},d=await ut(()=>fetch(r,c));if(d.ok){const s=await d.json();return st(s)}else throw await ct("Generate Auth Token",d)}function Cr(e,{fid:t}){return`${at(e)}/${t}/authTokens:generate`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function ge(e,t=!1){let n;const r=await q(e.appConfig,o=>{if(!wt(o))throw _.create("not-registered");const a=o.authToken;if(!t&&Nr(a))return o;if(a.requestStatus===1)return n=kr(e,t),o;{if(!navigator.onLine)throw _.create("app-offline");const c=Mr(o);return n=Rr(e,c),c}});return n?await n:r.authToken}async function kr(e,t){let n=await Oe(e.appConfig);for(;n.authToken.requestStatus===1;)await ft(100),n=await Oe(e.appConfig);const r=n.authToken;return r.requestStatus===0?ge(e,t):r}function Oe(e){return q(e,t=>{if(!wt(t))throw _.create("not-registered");const n=t.authToken;return Br(n)?{...t,authToken:{requestStatus:0}}:t})}async function Rr(e,t){try{const n=await Dr(e,t),r={...t,authToken:n};return await V(e.appConfig,r),n}catch(n){if(ot(n)&&(n.customData.serverCode===401||n.customData.serverCode===404))await bt(e.appConfig);else{const r={...t,authToken:{requestStatus:0}};await V(e.appConfig,r)}throw n}}function wt(e){return e!==void 0&&e.registrationStatus===2}function Nr(e){return e.requestStatus===2&&!Or(e)}function Or(e){const t=Date.now();return t<e.creationTime||e.creationTime+e.expiresIn<t+or}function Mr(e){const t={requestStatus:1,requestTime:Date.now()};return{...e,authToken:t}}function Br(e){return e.requestStatus===1&&e.requestTime+nt<Date.now()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Pr(e){const t=e,{installationEntry:n,registrationPromise:r}=await pe(t);return r?r.catch(console.error):ge(t).catch(console.error),n.fid}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Fr(e,t=!1){const n=e;return await $r(n),(await ge(n,t)).token}async function $r(e){const{registrationPromise:t}=await pe(e);t&&await t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Lr(e,t){const{appConfig:n}=e;return mr(n,t),()=>{wr(n,t)}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Hr(e){if(!e||!e.options)throw Q("App Configuration");if(!e.name)throw Q("App Name");const t=["projectId","apiKey","appId"];for(const n of t)if(!e.options[n])throw Q(n);return{appName:e.name,projectId:e.options.projectId,apiKey:e.options.apiKey,appId:e.options.appId}}function Q(e){return _.create("missing-app-config-values",{valueName:e})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const yt="installations",xr="installations-internal",jr=e=>{const t=e.getProvider("app").getImmediate(),n=Hr(t),r=fe(t,"heartbeat");return{app:t,appConfig:n,heartbeatServiceProvider:r,_delete:()=>Promise.resolve()}},Vr=e=>{const t=e.getProvider("app").getImmediate(),n=fe(t,yt).getImmediate();return{getId:()=>Pr(n),getToken:i=>Fr(n,i)}};function Ur(){S(new w(yt,jr,"PUBLIC")),S(new w(xr,Vr,"PRIVATE"))}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */Ur();E(tt,le);E(tt,le,"esm2020");/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Kr="/firebase-messaging-sw.js",Wr="/firebase-cloud-messaging-push-scope",It="BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4",qr="https://fcmregistrations.googleapis.com/v1",Et="google.c.a.c_id",zr="google.c.a.c_l",Gr="google.c.a.ts",Jr="google.c.a.e",Me=1e4;var Be;(function(e){e[e.DATA_MESSAGE=1]="DATA_MESSAGE",e[e.DISPLAY_NOTIFICATION=3]="DISPLAY_NOTIFICATION"})(Be||(Be={}));/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */var A;(function(e){e.PUSH_RECEIVED="push-received",e.NOTIFICATION_CLICKED="notification-clicked",e.FID_REGISTERED="fid-registered"})(A||(A={}));/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function l(e){const t=new Uint8Array(e);return btoa(String.fromCharCode(...t)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}function St(e){const t="=".repeat((4-e.length%4)%4),n=(e+t).replace(/\-/g,"+").replace(/_/g,"/"),r=atob(n),i=new Uint8Array(r.length);for(let o=0;o<r.length;++o)i[o]=r.charCodeAt(o);return i}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Z="fcm_token_details_db",Yr=5,Pe="fcm_token_object_Store";async function Xr(e){if("databases"in indexedDB&&!(await indexedDB.databases()).map(o=>o.name).includes(Z))return null;let t=null;return(await W(Z,Yr,{upgrade:async(r,i,o,a)=>{if(i<2||!r.objectStoreNames.contains(Pe))return;const c=a.objectStore(Pe),d=await c.index("fcmSenderId").get(e);if(await c.clear(),!!d){if(i===2){const s=d;if(!s.auth||!s.p256dh||!s.endpoint)return;t={token:s.fcmToken,createTime:s.createTime??Date.now(),subscriptionOptions:{auth:s.auth,p256dh:s.p256dh,endpoint:s.endpoint,swScope:s.swScope,vapidKey:typeof s.vapidKey=="string"?s.vapidKey:l(s.vapidKey)}}}else if(i===3){const s=d;t={token:s.fcmToken,createTime:s.createTime,subscriptionOptions:{auth:l(s.auth),p256dh:l(s.p256dh),endpoint:s.endpoint,swScope:s.swScope,vapidKey:l(s.vapidKey)}}}else if(i===4){const s=d;t={token:s.fcmToken,createTime:s.createTime,subscriptionOptions:{auth:l(s.auth),p256dh:l(s.p256dh),endpoint:s.endpoint,swScope:s.swScope,vapidKey:l(s.vapidKey)}}}}}})).close(),await x(Z),await x("fcm_vapid_details_db"),await x("undefined"),Qr(t)?t:null}function Qr(e){if(!e||!e.subscriptionOptions)return!1;const{subscriptionOptions:t}=e;return typeof e.createTime=="number"&&e.createTime>0&&typeof e.token=="string"&&e.token.length>0&&typeof t.auth=="string"&&t.auth.length>0&&typeof t.p256dh=="string"&&t.p256dh.length>0&&typeof t.endpoint=="string"&&t.endpoint.length>0&&typeof t.swScope=="string"&&t.swScope.length>0&&typeof t.vapidKey=="string"&&t.vapidKey.length>0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Zr={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"only-available-in-window":"This method is available in a Window context.","only-available-in-sw":"This method is available in a service worker context.","permission-default":"The notification permission was not granted and dismissed instead.","permission-blocked":"The notification permission was not granted and blocked instead.","unsupported-browser":"This browser doesn't support the API's required to use the Firebase SDK.","indexed-db-unsupported":"This browser doesn't support indexedDb.open() (ex. Safari iFrame, Firefox Private Browsing, etc)","failed-service-worker-registration":"We are unable to register the default service worker. {$browserErrorMessage}","token-subscribe-failed":"A problem occurred while subscribing the user to FCM: {$errorInfo}","token-subscribe-no-token":"FCM returned no token when subscribing the user to push.","fid-registration-failed":"A problem occurred while creating an FCM registration via FID: {$errorInfo}","fid-unregister-failed":"A problem occurred while unregistering the FCM registration via FID: {$errorInfo}","fid-registration-idb-schema-unavailable":"Unable to read or persist FID registration metadata because the messaging IndexedDB schema is unavailable (for example, the database could not be upgraded to the latest version).","token-unsubscribe-failed":"A problem occurred while unsubscribing the user from FCM: {$errorInfo}","token-update-failed":"A problem occurred while updating the user from FCM: {$errorInfo}","token-update-no-token":"FCM returned no token when updating the user to push.","use-sw-after-get-token":"The useServiceWorker() method may only be called once and must be called before calling getToken() to ensure your service worker is used.","invalid-sw-registration":"The input to useServiceWorker() must be a ServiceWorkerRegistration.","invalid-bg-handler":"The input to setBackgroundMessageHandler() must be a function.","invalid-vapid-key":"The public VAPID key must be a string.","use-vapid-key-after-get-token":"The usePublicVapidKey() method may only be called once and must be called before calling getToken() to ensure your VAPID key is used.","invalid-on-registered-handler":"No onRegistered callback handler was provided or registered. Implement onRegistered() before register()."},u=new U("messaging","Messaging",Zr);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Fe="firebase-messaging-database",$e=2,m="firebase-messaging-store",h="firebase-messaging-fid-registration-store",ei={openDB:W,deleteDB:x};let Le=ei,M=null;function ti(e,t,n){switch(t){case 0:if(e.createObjectStore(m),n===1)break;case 1:n===2&&e.createObjectStore(h)}}function He(e){return{upgrade:(t,n)=>{ti(t,n,e)},blocked:()=>{},blocking:(t,n,r)=>{var i;M=null,(i=r.target)==null||i.close()},terminated:()=>{M=null}}}function k(){return M||(M=Le.openDB(Fe,$e,He(2)).catch(()=>Le.openDB(Fe,$e-1,He(1)))),M}function _t(e,t){return e.objectStoreNames.contains(t)}function be(e){if(!_t(e,h))throw u.create("fid-registration-idb-schema-unavailable")}async function Tt(e){const t=R(e),r=await(await k()).transaction(m).objectStore(m).get(t);if(r)return r;{const i=await Xr(e.appConfig.senderId);if(i)return await me(e,i),i}}async function me(e,t){const n=R(e),r=await k(),i=[m],o=_t(r,h);o&&i.push(h);const a=r.transaction(i,"readwrite");return await a.objectStore(m).put(t,n),o&&await a.objectStore(h).delete(n),await a.done,t}async function ni(e){const t=R(e),r=(await k()).transaction(m,"readwrite");await r.objectStore(m).delete(t),await r.done}async function we(e){const t=R(e),n=await k();return be(n),await n.transaction(h).objectStore(h).get(t)}async function ri(e,t){const n=R(e),r=await k();be(r);const i=r.transaction([m,h],"readwrite");return await i.objectStore(h).put(t,n),await i.objectStore(m).delete(n),await i.done,t}async function ii(e){const t=R(e),n=await k();be(n);const r=n.transaction(h,"readwrite");await r.objectStore(h).delete(t),await r.done}function R({appConfig:e}){return e.appId}const xe="@firebase/messaging",de="0.13.3";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const oi=3,ai=1e3;async function si(e,t){const n=await F(e),r=ye(t,e.appConfig.appName,!1),i={method:"POST",headers:n,body:JSON.stringify(r)};let o;try{o=await(await fetch(P(e.appConfig),i)).json()}catch(a){throw u.create("token-subscribe-failed",{errorInfo:a==null?void 0:a.toString()})}if(o.error){const a=o.error.message;throw u.create("token-subscribe-failed",{errorInfo:a})}if(!o.token)throw u.create("token-subscribe-no-token");return o.token}async function ci(e,t){var d;const n=await F(e),r=ye(t,e.appConfig.appName,!0),i={method:"POST",headers:n,body:JSON.stringify(r)};let o;try{o=await hi(()=>fetch(P(e.appConfig),i),oi,ai)}catch(s){throw u.create("fid-registration-failed",{errorInfo:s==null?void 0:s.toString()})}if(o.ok)return{responseFid:await ui(o)};let a;try{a=await o.json()}catch{throw u.create("fid-registration-failed",{errorInfo:o.statusText})}const c=((d=a.error)==null?void 0:d.message)??o.statusText;throw u.create("fid-registration-failed",{errorInfo:c})}async function di(e,t){var o;const r={method:"DELETE",headers:await F(e)};let i;try{i=await fetch(`${P(e.appConfig)}/${t}`,r)}catch(a){throw u.create("fid-unregister-failed",{errorInfo:a==null?void 0:a.toString()})}if(!i.ok)try{throw((o=(await i.json()).error)==null?void 0:o.message)??i.statusText}catch(a){throw u.create("fid-unregister-failed",{errorInfo:typeof a=="string"&&a||i.statusText||(a==null?void 0:a.toString())})}}async function ui(e){const t=await e.text();if(!t.trim())throw u.create("fid-registration-failed",{errorInfo:"CreateRegistration succeeded but response body is empty"});let n;try{n=JSON.parse(t)}catch{throw u.create("fid-registration-failed",{errorInfo:"CreateRegistration succeeded but response body is not valid JSON"})}const r=n.name;if(typeof r!="string"||r.length===0)throw u.create("fid-registration-failed",{errorInfo:"CreateRegistration succeeded but response did not include a non-empty name"});return fi(r)}const je="/registrations/";function fi(e){const t=e.indexOf(je);if(t!==-1){const n=e.slice(t+je.length);if(n.length>0)return n}throw u.create("fid-registration-failed",{errorInfo:"CreateRegistration succeeded but response name is not a valid registration resource name"})}async function li(e,t){const n=await F(e),r=ye(t.subscriptionOptions,e.appConfig.appName,!1),i={method:"PATCH",headers:n,body:JSON.stringify(r)};let o;try{o=await(await fetch(`${P(e.appConfig)}/${t.token}`,i)).json()}catch(a){throw u.create("token-update-failed",{errorInfo:a==null?void 0:a.toString()})}if(o.error){const a=o.error.message;throw u.create("token-update-failed",{errorInfo:a})}if(!o.token)throw u.create("token-update-no-token");return o.token}async function vt(e,t){const r={method:"DELETE",headers:await F(e)};try{const o=await(await fetch(`${P(e.appConfig)}/${t}`,r)).json();if(o.error){const a=o.error.message;throw u.create("token-unsubscribe-failed",{errorInfo:a})}}catch(i){throw u.create("token-unsubscribe-failed",{errorInfo:i==null?void 0:i.toString()})}}async function hi(e,t,n){let r;for(let i=0;i<t;i++)try{return await e()}catch(o){if(r=o,i<t-1){const a=n*Math.pow(2,i);await new Promise(c=>setTimeout(c,a))}}throw r}function P({projectId:e}){return`${qr}/projects/${e}/registrations`}async function F({appConfig:e,installations:t}){const n=await t.getToken();return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e.apiKey,"x-goog-firebase-installations-auth":`FIS ${n}`})}function pi(e,t){var n,r;try{if(/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(e))return new URL(e).host}catch{}try{if(typeof self<"u"&&((n=self.location)!=null&&n.href))return new URL(e,self.location.origin).host}catch{}return typeof self<"u"&&((r=self.location)!=null&&r.host)?self.location.host:t}function ye({p256dh:e,auth:t,endpoint:n,vapidKey:r,swScope:i},o,a){const c={web:{origin:pi(i,o),endpoint:n,auth:t,p256dh:e}};return a&&(c.fcm_sdk_version=de),r!==It&&(c.web.applicationPubKey=r),c}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const gi=7*24*60*60*1e3;async function bi(e){const t=await Ei(e.swRegistration,e.vapidKey),n={vapidKey:e.vapidKey,swScope:e.swRegistration.scope,endpoint:t.endpoint,auth:l(t.getKey("auth")),p256dh:l(t.getKey("p256dh"))},r=await Tt(e.firebaseDependencies);if(r){if(Si(r.subscriptionOptions,n))return Date.now()>=r.createTime+gi?Ii(e,{token:r.token,createTime:Date.now(),subscriptionOptions:n}):r.token;try{await vt(e.firebaseDependencies,r.token)}catch(i){}return Ve(e.firebaseDependencies,n)}else return Ve(e.firebaseDependencies,n)}async function mi(e,t){await vt(e.firebaseDependencies,t.token),await ni(e.firebaseDependencies),await At(e.firebaseDependencies)}async function wi(e){const t=await we(e.firebaseDependencies).catch(()=>{}),n=t==null?void 0:t.fid;n&&await di(e.firebaseDependencies,n),await At(e.firebaseDependencies),n&&Ti(e,n)}async function yi(e){const t=await Tt(e.firebaseDependencies);t?await mi(e,t):await wi(e);const n=await e.swRegistration.pushManager.getSubscription();return n?n.unsubscribe():!0}async function Ii(e,t){try{const n=await li(e.firebaseDependencies,t),r={...t,token:n,createTime:Date.now()};return await me(e.firebaseDependencies,r),n}catch(n){throw n}}async function Ve(e,t){const r={token:await si(e,t),createTime:Date.now(),subscriptionOptions:t};return await me(e,r),r.token}async function Ei(e,t){const n=await e.pushManager.getSubscription();return n||e.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:St(t)})}function Si(e,t){const n=t.vapidKey===e.vapidKey,r=t.endpoint===e.endpoint,i=t.auth===e.auth,o=t.p256dh===e.p256dh;return n&&r&&i&&o}async function At(e){try{await ii(e)}catch{}}function _i(e,t){const n=e.onRegisteredHandler;n&&(typeof n=="function"?n(t):n.next(t))}function Ti(e,t){const n=e.onUnregisteredHandler;n&&(typeof n=="function"?n(t):n.next(t))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Dt(e){try{e.swRegistration=await navigator.serviceWorker.register(Kr,{scope:Wr}),e.swRegistration.update().catch(()=>{}),await vi(e.swRegistration)}catch(t){throw u.create("failed-service-worker-registration",{browserErrorMessage:t==null?void 0:t.message})}}async function vi(e){return new Promise((t,n)=>{const r=setTimeout(()=>n(new Error(`Service worker not registered after ${Me} ms`)),Me),i=e.installing||e.waiting;e.active?(clearTimeout(r),t()):i?i.onstatechange=o=>{var a;((a=o.target)==null?void 0:a.state)==="activated"&&(i.onstatechange=null,clearTimeout(r),t())}:(clearTimeout(r),n(new Error("No incoming service worker found.")))})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Ct(e,t){if(!t&&!e.swRegistration&&await Dt(e),!(!t&&e.swRegistration)){if(!(t instanceof ServiceWorkerRegistration))throw u.create("invalid-sw-registration");e.swRegistration=t}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function kt(e,t){t?e.vapidKey=t:e.vapidKey||(e.vapidKey=It)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ue=3;async function Ai(e,t){const n=await Di(e.swRegistration,e.vapidKey),r={vapidKey:e.vapidKey,swScope:e.swRegistration.scope,endpoint:n.endpoint,auth:l(n.getKey("auth")),p256dh:l(n.getKey("p256dh"))},i=e.firebaseDependencies.installations;for(let o=0;o<Ue;o++){const{responseFid:a}=await ci(e.firebaseDependencies,r);if(a===t)return;o<Ue-1&&await i.getToken(!0)}throw u.create("fid-registration-failed",{errorInfo:"CreateRegistration response FID does not match Firebase Installation ID"})}async function Di(e,t){const n=await e.pushManager.getSubscription();return n||e.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:St(t)})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ci=7*24*60*60*1e3;async function Rt(e,t){if(!navigator)throw u.create("only-available-in-window");if(Notification.permission==="default"&&await Notification.requestPermission(),Notification.permission!=="granted")throw u.create("permission-blocked");if(!e.onRegisteredHandler)throw u.create("invalid-on-registered-handler");await kt(e,t==null?void 0:t.vapidKey),await Ct(e,t==null?void 0:t.serviceWorkerRegistration);const n=e._registerNotifyChain.catch(()=>{});return e._registerNotifyChain=n.then(async()=>{const r=await e.firebaseDependencies.installations.getId(),i=await we(e.firebaseDependencies),o=Date.now();if((!i||i.fid!==r||o>=i.lastRegisterTime+Ci)&&(await Ai(e,r),await ri(e.firebaseDependencies,{fid:r,lastRegisterTime:o,vapidKey:e.vapidKey})),!e.onRegisteredHandler)throw u.create("invalid-on-registered-handler");_i(e,r)}),e._registerNotifyChain}/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ki(e,t){return Lr(t,()=>{(async()=>!e.onRegisteredHandler||!await we(e.firebaseDependencies)||await Rt(e).catch(()=>{}))()})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ke(e){const t={from:e.from,collapseKey:e.collapse_key,messageId:e.fcmMessageId};return Ri(t,e),Ni(t,e),Oi(t,e),t}function Ri(e,t){if(!t.notification)return;e.notification={};const n=t.notification.title;n&&(e.notification.title=n);const r=t.notification.body;r&&(e.notification.body=r);const i=t.notification.image;i&&(e.notification.image=i);const o=t.notification.icon;o&&(e.notification.icon=o)}function Ni(e,t){t.data&&(e.data=t.data)}function Oi(e,t){var i,o,a,c;if(!t.fcmOptions&&!((i=t.notification)!=null&&i.click_action))return;e.fcmOptions={};const n=((o=t.fcmOptions)==null?void 0:o.link)??((a=t.notification)==null?void 0:a.click_action);n&&(e.fcmOptions.link=n);const r=(c=t.fcmOptions)==null?void 0:c.analytics_label;r&&(e.fcmOptions.analyticsLabel=r)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Mi(e){return typeof e=="object"&&!!e&&Et in e}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Bi(e){if(!e||!e.options)throw ee("App Configuration Object");if(!e.name)throw ee("App Name");const t=["projectId","apiKey","appId","messagingSenderId"],{options:n}=e;for(const r of t)if(!n[r])throw ee(r);return{appName:e.name,projectId:n.projectId,apiKey:n.apiKey,appId:n.appId,senderId:n.messagingSenderId}}function ee(e){return u.create("missing-app-config-values",{valueName:e})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Pi{constructor(t,n,r){this.deliveryMetricsExportedToBigQueryEnabled=!1,this.onBackgroundMessageHandler=null,this.onMessageHandler=null,this.onRegisteredHandler=null,this.onUnregisteredHandler=null,this._registerNotifyChain=Promise.resolve(),this._fidChangeUnsubscribe=null,this.logEvents=[],this.logQueue={state:"stopped"};const i=Bi(t);this.firebaseDependencies={app:t,appConfig:i,installations:n,analyticsProvider:r}}_delete(){return this._fidChangeUnsubscribe&&(this._fidChangeUnsubscribe(),this._fidChangeUnsubscribe=null),this.logQueue.state==="scheduled"&&clearTimeout(this.logQueue.timerId),this.logQueue={state:"stopped"},Promise.resolve()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Nt(e,t){if(!navigator)throw u.create("only-available-in-window");if(Notification.permission==="default"&&await Notification.requestPermission(),Notification.permission!=="granted")throw u.create("permission-blocked");return await kt(e,t==null?void 0:t.vapidKey),await Ct(e,t==null?void 0:t.serviceWorkerRegistration),bi(e)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Fi(e,t,n){const r=$i(t);(await e.firebaseDependencies.analyticsProvider.get()).logEvent(r,{message_id:n[Et],message_name:n[zr],message_time:n[Gr],message_device_time:Math.floor(Date.now()/1e3)})}function $i(e){switch(e){case A.NOTIFICATION_CLICKED:return"notification_open";case A.PUSH_RECEIVED:return"notification_foreground";default:throw new Error}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Li(e,t){const n=t.data;if(!n.isFirebaseMessaging)return;if(e.onMessageHandler&&n.messageType===A.PUSH_RECEIVED&&(typeof e.onMessageHandler=="function"?e.onMessageHandler(Ke(n)):e.onMessageHandler.next(Ke(n))),e.onRegisteredHandler&&n.messageType===A.FID_REGISTERED){const i=n.fid;typeof e.onRegisteredHandler=="function"?e.onRegisteredHandler(i):e.onRegisteredHandler.next(i)}const r=n.data;Mi(r)&&r[Jr]==="1"&&await Fi(e,n.messageType,r)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Hi=e=>{const t=new Pi(e.getProvider("app").getImmediate(),e.getProvider("installations-internal").getImmediate(),e.getProvider("analytics-internal"));return navigator.serviceWorker.addEventListener("message",n=>Li(t,n)),t._fidChangeUnsubscribe=ki(t,e.getProvider("installations").getImmediate()),t},xi=e=>{const t=e.getProvider("messaging").getImmediate();return{getToken:r=>Nt(t,r),register:r=>Rt(t,r)}};function ji(){S(new w("messaging",Hi,"PUBLIC")),S(new w("messaging-internal",xi,"PRIVATE")),E(xe,de),E(xe,de,"esm2020")}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function O(){try{await Ye()}catch{return!1}return typeof window<"u"&&Je()&&Wt()&&"serviceWorker"in navigator&&"PushManager"in window&&"Notification"in window&&"fetch"in window&&ServiceWorkerRegistration.prototype.hasOwnProperty("showNotification")&&PushSubscription.prototype.hasOwnProperty("getKey")}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Vi(e){if(!navigator)throw u.create("only-available-in-window");return e.swRegistration||await Dt(e),yi(e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ui(e,t){if(!navigator)throw u.create("only-available-in-window");return e.onMessageHandler=t,()=>{e.onMessageHandler=null}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function te(e=zn()){return O().then(t=>{if(!t)throw u.create("unsupported-browser")},t=>{throw u.create("indexed-db-unsupported")}),fe(K(e),"messaging").getImmediate()}async function Ki(e,t){return e=K(e),Nt(e,t)}function Wi(e){return e=K(e),Vi(e)}function qi(e,t){return e=K(e),Ui(e,t)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */ji();class Ie extends Mt{constructor(){super(),O().then(t=>{if(!t)return;const n=te();qi(n,r=>this.handleNotificationReceived(r))})}async checkPermissions(){return await O()?{receive:this.convertNotificationPermissionToPermissionState(Notification.permission)}:{receive:"denied"}}async requestPermissions(){if(!await O())return{receive:"denied"};const n=await Notification.requestPermission();return{receive:this.convertNotificationPermissionToPermissionState(n)}}async isSupported(){return{isSupported:await O()}}async getToken(t){const n=te();return{token:await Ki(n,{vapidKey:t.vapidKey,serviceWorkerRegistration:t.serviceWorkerRegistration})}}async deleteToken(){const t=te();await Wi(t)}async getDeliveredNotifications(){this.throwUnimplementedError()}async removeDeliveredNotifications(t){this.throwUnimplementedError()}async removeAllDeliveredNotifications(){this.throwUnimplementedError()}async subscribeToTopic(t){this.throwUnimplementedError()}async unsubscribeFromTopic(t){this.throwUnimplementedError()}async createChannel(t){this.throwUnimplementedError()}async deleteChannel(t){this.throwUnimplementedError()}async listChannels(){this.throwUnimplementedError()}handleNotificationReceived(t){const r={notification:this.createNotificationResult(t)};this.notifyListeners(Ie.notificationReceivedEvent,r)}createNotificationResult(t){var n,r,i;return{body:(n=t.notification)===null||n===void 0?void 0:n.body,data:t.data,id:t.messageId,image:(r=t.notification)===null||r===void 0?void 0:r.image,title:(i=t.notification)===null||i===void 0?void 0:i.title}}convertNotificationPermissionToPermissionState(t){let n="prompt";switch(t){case"granted":n="granted";break;case"denied":n="denied";break}return n}throwUnimplementedError(){throw this.unimplemented("Not implemented on web.")}}Ie.notificationReceivedEvent="notificationReceived";export{Ie as FirebaseMessagingWeb};
