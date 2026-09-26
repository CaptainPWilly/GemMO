'use strict';
const crypto=require('node:crypto');
const {promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt);
const SCRYPT={N:32768,r:8,p:1,maxmem:64*1024*1024};
const KEYLEN=64;
function normalizeUsername(value){return String(value||'').trim().toLowerCase()}
function validateUsername(value){const display=String(value||'').trim(),normalized=normalizeUsername(display);if(display.length<3||display.length>20||!/^[A-Za-z0-9_]+$/.test(display))return null;return {display,normalized}}
function validatePassword(value){return typeof value==='string'&&value.length>=6&&value.length<=128}
async function derive(password,salt){return Buffer.from(await scrypt(password,salt,KEYLEN,SCRYPT))}
async function hashPassword(password){const salt=crypto.randomBytes(16),key=await derive(password,salt);return ['scrypt',SCRYPT.N,SCRYPT.r,SCRYPT.p,salt.toString('base64url'),key.toString('base64url')].join('$')}
async function verifyPassword(password,encoded){try{const [kind,n,r,p,saltB64,keyB64]=String(encoded).split('$');if(kind!=='scrypt')return false;const salt=Buffer.from(saltB64,'base64url'),expected=Buffer.from(keyB64,'base64url'),actual=Buffer.from(await scrypt(password,salt,expected.length,{N:Number(n),r:Number(r),p:Number(p),maxmem:64*1024*1024}));return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual)}catch{return false}}
async function burnPassword(password){await scrypt(String(password||''),Buffer.from('GemMO-login-equalize','utf8'),KEYLEN,SCRYPT)}
function createSessionToken(){return crypto.randomBytes(32).toString('base64url')}
function hashToken(token){return crypto.createHash('sha256').update(String(token)).digest('hex')}
module.exports={normalizeUsername,validateUsername,validatePassword,hashPassword,verifyPassword,burnPassword,createSessionToken,hashToken};
