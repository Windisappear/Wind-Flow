import 'reflect-metadata';import { NestFactory } from '@nestjs/core';import { SwaggerModule,DocumentBuilder } from '@nestjs/swagger';import { AppModule } from './modules';
import { readFileSync, existsSync } from 'node:fs';
if (existsSync('.env')) for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) { const match = line.match(/^([A-Z0-9_]+)=(.*)$/); if (match && !process.env[match[1]]) process.env[match[1]] = match[2]; }
async function bootstrap(){
 const app=await NestFactory.create(AppModule,{bodyParser:false});
 app.use((req:any,_res:any,next:any)=>{
  if(req.method==='GET'||req.method==='HEAD'||!String(req.headers['content-type']||'').includes('application/json')) return next();
  let raw=''; req.on('data',(chunk:Buffer)=>{raw+=chunk.toString('utf8')}); req.on('end',()=>{try{req.body=raw?JSON.parse(raw):{};next()}catch{req.body={};next()}});
 });
 app.setGlobalPrefix('api');app.enableCors();const config=new DocumentBuilder().setTitle('Infinite Canvas API').setVersion('0.1').addBearerAuth().build();SwaggerModule.setup('api/docs',app,SwaggerModule.createDocument(app,config));await app.listen(process.env.PORT||3000)
}bootstrap();
