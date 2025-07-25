'use strict';

const { query } = require('express');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create the news Skill table
    await queryInterface.createTable('NewSkills', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
    });

    // 2. Insert distinct skills from the old Skills table into NewSkills
    await queryInterface.sequelize.query(`
      INSERT INTO "NewSkills"(id, name)
      SELECT DISTINCT ON (LOWER(name)) gen_random_uuid(), name
      FROM "Skills"
      ORDER BY LOWER(name), id
    `);

    // 3. Remove foreign key constraints from ExperienceSkills and FormationSkills
    await queryInterface.removeConstraint(
      'ExperienceSkills',
      'ExperienceSkills_skillId_fkey'
    );
    await queryInterface.removeConstraint(
      'FormationSkills',
      'FormationSkills_skillId_fkey'
    );

    // 4. Update ExperienceSkills and FormationSkills to reference NewSkills
    await queryInterface.sequelize.query(`
      UPDATE "ExperienceSkills" es
      SET "skillId" = ns.id
      FROM "Skills" s
      JOIN "NewSkills" ns ON LOWER(s.name) = LOWER(ns.name)
      WHERE es."skillId" = s.id
    `);

    await queryInterface.sequelize.query(`
      UPDATE "FormationSkills" fs
      SET "skillId" = ns.id
      FROM "Skills" s
      JOIN "NewSkills" ns ON LOWER(s.name) = LOWER(ns.name)
      WHERE fs."skillId" = s.id
    `);

    // 5. Create UserProfileSkills table
    await queryInterface.createTable('UserProfileSkills', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      userProfileId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'UserProfiles',
          key: 'id',
        },
      },
      skillId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'NewSkills',
          key: 'id',
        },
      },
      order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: -1,
      },
    });

    // 6. Insert UserProfileSkills with the new skills
    await queryInterface.sequelize.query(`
      INSERT INTO "UserProfileSkills"(id, "userProfileId", "skillId", "order")
      SELECT
        gen_random_uuid(),
        s."userProfileId",
        ns.id,
        s."order"
      FROM "Skills" s
      JOIN "NewSkills" ns ON LOWER(s.name) = LOWER(ns.name)
      WHERE s."order" != -1
    `);

    // 7. Drop the old Skills table
    await queryInterface.dropTable('Skills');

    // 8. Rename NewSkills back to Skills
    await queryInterface.renameTable('NewSkills', 'Skills');

    // 9. Add foreign key constraints
    await queryInterface.addConstraint('ExperienceSkills', {
      fields: ['skillId'],
      type: 'foreign key',
      name: 'ExperienceSkills_skillId_fkey',
      references: { table: 'Skills', field: 'id' },
      onDelete: 'CASCADE',
    });

    await queryInterface.addConstraint('FormationSkills', {
      fields: ['skillId'],
      type: 'foreign key',
      name: 'FormationSkills_skillId_fkey',
      references: { table: 'Skills', field: 'id' },
      onDelete: 'CASCADE',
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Revert the migration by dropping UserProfileSkills,
     * and restoring the old Skills table.
     * The data will not be restored.
     */
    // 1. Drop UserProfileSkills table
    await queryInterface.dropTable('UserProfileSkills');
    // 2. Add order to Skills table
    await queryInterface.addColumn('Skills', 'order', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: -1,
    });
    // 3. Remove all data in Skills table
    await queryInterface.sequelize.query(`
      DELETE FROM "Skills"
    `);

    // 4. add userProfileId to Skills table
    await queryInterface.addColumn('Skills', 'userProfileId', {
      type: Sequelize.UUID,
      allowNull: null,
      references: {
        model: 'UserProfiles',
        key: 'id',
      },
    });
  },
};
