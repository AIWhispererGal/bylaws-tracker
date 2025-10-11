// Migration Script: Generalize Bylaws Amendment Tracker Schema
// Version: 2.0.0
// Purpose: Transform single-organization schema to multi-tenant architecture

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(db) {
    // 1. Add organization_id to existing tables
    await Promise.all([
      db.schema.table('bylaw_sections', (table) => {
        table.uuid('organization_id').nullable();
      }),
      db.schema.table('bylaw_suggestions', (table) => {
        table.uuid('organization_id').nullable();
      }),
      db.schema.table('bylaw_votes', (table) => {
        table.uuid('organization_id').nullable();
      })
    ]);

    // 2. Create organizations table
    await db.schema.createTable('organizations', (table) => {
      table.uuid('id').primary().defaultTo(uuidv4());
      table.string('name').notNullable();
      table.string('type').nullable();
      table.jsonb('configuration').nullable();
      table.timestamps(true, true);
    });

    // 3. Migrate existing data to default organization
    const defaultOrgId = uuidv4();
    await db('organizations').insert({
      id: defaultOrgId,
      name: 'Default Organization',
      type: 'neighborhood_council'
    });

    await Promise.all([
      db('bylaw_sections').update({ organization_id: defaultOrgId }),
      db('bylaw_suggestions').update({ organization_id: defaultOrgId }),
      db('bylaw_votes').update({ organization_id: defaultOrgId })
    ]);

    // 4. Add foreign key constraints
    await Promise.all([
      db.schema.table('bylaw_sections', (table) => {
        table.foreign('organization_id').references('id').inTable('organizations');
      }),
      db.schema.table('bylaw_suggestions', (table) => {
        table.foreign('organization_id').references('id').inTable('organizations');
      }),
      db.schema.table('bylaw_votes', (table) => {
        table.foreign('organization_id').references('id').inTable('organizations');
      })
    ]);

    console.log('Schema generalization complete');
  },

  async down(db) {
    // Rollback migration
    await Promise.all([
      db.schema.table('bylaw_sections', (table) => {
        table.dropColumn('organization_id');
      }),
      db.schema.table('bylaw_suggestions', (table) => {
        table.dropColumn('organization_id');
      }),
      db.schema.table('bylaw_votes', (table) => {
        table.dropColumn('organization_id');
      }),
      db.schema.dropTable('organizations')
    ]);

    console.log('Rollback to single-organization schema complete');
  }
};