// Local test receiver only: never forwards any message to the Internet.
import tls from 'node:tls'
import http from 'node:http'
import fs from 'node:fs'
let messages=[],fail=false
const server=tls.createServer({key:fs.readFileSync('/fixtures/server.key'),cert:fs.readFileSync('/fixtures/server.crt')},socket=>{
  socket.setEncoding('utf8');socket.write('220 sgt-smtp test receiver\r\n')
  let buffer='',data=false,mail=[],auth=0,recipient=''
  socket.on('data',chunk=>{
    buffer+=chunk
    while(buffer.includes('\n')){
      const i=buffer.indexOf('\n'),line=buffer.slice(0,i).replace(/\r$/,'');buffer=buffer.slice(i+1)
      if(data){
        if(line!=='.'){mail.push(line.replace(/^\.\./,'.'));continue}
        data=false
        if(fail)socket.write('451 test temporary failure\r\n')
        else{messages.push({recipient,message:mail.join('\r\n')});socket.write('250 stored by test receiver\r\n')}
        mail=[];continue
      }
      if(auth===1){auth=2;socket.write('334 UGFzc3dvcmQ6\r\n');continue}
      if(auth===2){auth=0;socket.write('235 authenticated for test\r\n');continue}
      if(/^EHLO|^HELO/.test(line))socket.write('250-sgt-smtp\r\n250-AUTH LOGIN\r\n250 SIZE 15000000\r\n')
      else if(/^AUTH LOGIN/.test(line)){auth=1;socket.write('334 VXNlcm5hbWU6\r\n')}
      else if(/^MAIL FROM:/.test(line))socket.write('250 sender ok\r\n')
      else if(/^RCPT TO:/.test(line)){recipient=line.slice(8).replace(/[<>]/g,'').trim();socket.write(recipient==='ok@sgt-h.ru'?'250 recipient ok\r\n':'550 unexpected test recipient\r\n')}
      else if(line==='DATA'){data=true;socket.write('354 end with dot\r\n')}
      else if(line==='QUIT'){socket.end('221 goodbye\r\n')}
      else socket.write('250 ok\r\n')
    }
  })
  socket.on('error',()=>{})
})
server.on('tlsClientError',()=>{})
server.listen(465,'0.0.0.0')
http.createServer(async(req,res)=>{
  if(req.method==='POST'){let body='';for await(const chunk of req)body+=chunk;fail=JSON.parse(body).fail===true}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({messages,fail}))
}).listen(8025,'0.0.0.0')
