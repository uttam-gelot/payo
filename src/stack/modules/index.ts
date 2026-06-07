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

// Databases (follow-up questions)
import { postgres } from './db/postgres';
import { mysql } from './db/mysql';
import { sqlite } from './db/sqlite';
import { mongodb } from './db/mongodb';

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
  // databases
  postgres,
  mysql,
  sqlite,
  mongodb,
  // config
  tsconfig,
]) {
  registerModule(m);
}
