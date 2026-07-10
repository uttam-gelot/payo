/**
 * Registers every built-in tech module. Import once at startup (the flow does)
 * to populate the registry. Modules are grouped by category under subfolders.
 */
import { registerModule } from '../registry';

// Frameworks — JS/TS
import { nestjs } from './framework/nestjs';
import { nextjs } from './framework/nextjs';
import { react } from './framework/react';
import { vue } from './framework/vue';
import { angular } from './framework/angular';
import { svelte } from './framework/svelte';
import { solid } from './framework/solid';
import { nuxtjs } from './framework/nuxtjs';
import { sveltekit } from './framework/sveltekit';
import { remix } from './framework/remix';
import { astro } from './framework/astro';
import { express } from './framework/express';
import { fastify } from './framework/fastify';
import { hono } from './framework/hono';
import { koa } from './framework/koa';
// Frameworks — Python
import { fastapi } from './framework/fastapi';
import { django } from './framework/django';
import { flask } from './framework/flask';
import { litestar } from './framework/litestar';
// Frameworks — Go
import { gin } from './framework/gin';
import { echo } from './framework/echo';
import { fiber } from './framework/fiber';
import { chi } from './framework/chi';
// Frameworks — Rust
import { axum } from './framework/axum';
import { actix } from './framework/actix';
import { rocket } from './framework/rocket';
// Frameworks — PHP
import { laravel } from './framework/laravel';
// Frameworks — C# / .NET
import { aspnetCore } from './framework/aspnet-core';
// Frameworks — Java
import { springBoot } from './framework/spring-boot';
// Frameworks — Ruby
import { rails } from './framework/rails';

// ORMs / data-access — JS/TS
import { prisma } from './orm/prisma';
import { drizzle } from './orm/drizzle';
import { kysely } from './orm/kysely';
import { typeorm } from './orm/typeorm';
import { mikroorm } from './orm/mikroorm';
import { sequelize } from './orm/sequelize';
import { mongoose } from './orm/mongoose';
// ORMs — Python
import { sqlalchemy } from './orm/sqlalchemy';
import { sqlmodel } from './orm/sqlmodel';
import { tortoise } from './orm/tortoise';
import { peewee } from './orm/peewee';
import { djangoOrm } from './orm/django-orm';
import { beanie } from './orm/beanie';
import { mongoengine } from './orm/mongoengine';
import { motor } from './orm/motor';
// ORMs — Go
import { gorm } from './orm/gorm';
import { sqlc } from './orm/sqlc';
import { ent } from './orm/ent';
import { sqlxGo } from './orm/sqlx-go';
import { mongoGoDriver } from './orm/mongo-go-driver';
// ORMs — Rust
import { seaorm } from './orm/seaorm';
import { sqlxRust } from './orm/sqlx-rust';
import { diesel } from './orm/diesel';
import { mongodbRust } from './orm/mongodb-rust';
// ORMs — PHP
import { eloquent } from './orm/eloquent';
// ORMs — C# / .NET
import { efCore } from './orm/ef-core';
import { dapper } from './orm/dapper';
// ORMs — Java
import { springDataJpa } from './orm/spring-data-jpa';
// ORMs — Ruby
import { activeRecord } from './orm/active-record';

// Databases (follow-up questions)
import { postgres } from './db/postgres';
import { mysql } from './db/mysql';
import { sqlite } from './db/sqlite';
import { mongodb } from './db/mongodb';

// Styling (follow-up questions + guidance)
import { tailwind } from './styling/tailwind';
import { shadcn } from './styling/shadcn';
import { cssModules } from './styling/css-modules';
import { styledComponents } from './styling/styled-components';
import { emotion } from './styling/emotion';
import { mui } from './styling/mui';
import { mantine } from './styling/mantine';
import { chakra } from './styling/chakra';
import { antd } from './styling/antd';
import { unocss } from './styling/unocss';
import { panda } from './styling/panda';
import { bootstrap } from './styling/bootstrap';
import { daisyui } from './styling/daisyui';
import { vanillaCss } from './styling/vanilla-css';

// Auth providers (follow-up questions + guidance)
import { clerk } from './auth/clerk';
import { authjs } from './auth/authjs';
import { betterAuth } from './auth/better-auth';
import { supabaseAuth } from './auth/supabase-auth';
import { auth0 } from './auth/auth0';
import { cognito } from './auth/cognito';
import { passport } from './auth/passport';
import { customAuth } from './auth/custom';
import { customJwt } from './auth/custom-jwt';
import { djangoAllauth } from './auth/django-allauth';
import { djangoAuth } from './auth/django-auth';
import { authlib } from './auth/authlib';
import { fastapiUsers } from './auth/fastapi-users';
import { golangJwt } from './auth/golang-jwt';
import { goth } from './auth/goth';
import { sessions } from './auth/sessions';
import { jsonwebtoken } from './auth/jsonwebtoken';
import { towerSessions } from './auth/tower-sessions';
import { oauth2 } from './auth/oauth2';
import { laravelSanctum } from './auth/laravel-sanctum';
import { laravelBreeze } from './auth/laravel-breeze';
import { laravelPassport } from './auth/laravel-passport';
import { devise } from './auth/devise';
import { omniauth } from './auth/omniauth';

// Compiler / tooling config
import { tsconfig } from './config/tsconfig';

for (const m of [
  // frameworks — JS/TS
  nestjs,
  nextjs,
  react,
  vue,
  angular,
  svelte,
  solid,
  nuxtjs,
  sveltekit,
  remix,
  astro,
  express,
  fastify,
  hono,
  koa,
  // frameworks — Python
  fastapi,
  django,
  flask,
  litestar,
  // frameworks — Go
  gin,
  echo,
  fiber,
  chi,
  // frameworks — Rust
  axum,
  actix,
  rocket,
  // frameworks — PHP
  laravel,
  // frameworks — C# / .NET
  aspnetCore,
  // frameworks — Java
  springBoot,
  // frameworks — Ruby
  rails,
  // orms — JS/TS
  prisma,
  drizzle,
  kysely,
  typeorm,
  mikroorm,
  sequelize,
  mongoose,
  // orms — Python
  sqlalchemy,
  sqlmodel,
  tortoise,
  peewee,
  djangoOrm,
  beanie,
  mongoengine,
  motor,
  // orms — Go
  gorm,
  sqlc,
  ent,
  sqlxGo,
  mongoGoDriver,
  // orms — Rust
  seaorm,
  sqlxRust,
  diesel,
  mongodbRust,
  // orms — PHP
  eloquent,
  // orms — C# / .NET
  efCore,
  dapper,
  // orms — Java
  springDataJpa,
  // orms — Ruby
  activeRecord,
  // databases
  postgres,
  mysql,
  sqlite,
  mongodb,
  // styling
  tailwind,
  shadcn,
  cssModules,
  styledComponents,
  emotion,
  mui,
  mantine,
  chakra,
  antd,
  unocss,
  panda,
  bootstrap,
  daisyui,
  vanillaCss,
  // auth
  clerk,
  authjs,
  betterAuth,
  supabaseAuth,
  auth0,
  cognito,
  passport,
  customAuth,
  customJwt,
  djangoAllauth,
  djangoAuth,
  authlib,
  fastapiUsers,
  golangJwt,
  goth,
  sessions,
  jsonwebtoken,
  towerSessions,
  oauth2,
  laravelSanctum,
  laravelBreeze,
  laravelPassport,
  devise,
  omniauth,
  // config
  tsconfig,
]) {
  registerModule(m);
}
