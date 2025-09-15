'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Création de la table RecruitementAlerts
    await queryInterface.createTable('RecruitementAlerts', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      name: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      jobName: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      workingExperienceYears: {
        allowNull: true,
        type: Sequelize.ENUM(
          'less_than_3_year',
          'between_3_and_10_years',
          'more_than_10_years',
          'jnspr'
        ),
      },
      contractType: {
        allowNull: true,
        type: Sequelize.ENUM(
          'cdi',
          'cdd',
          'cdd+6',
          'cdd-6',
          'cddi',
          'alt',
          'inte',
          'stage',
          'form',
          'pmsmp',
          'other'
        ),
      },
      companyId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'Companies',
          key: 'id',
        },
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });

    // Création de la table RecruitementAlertBusinessSectors (table de liaison)
    await queryInterface.createTable('RecruitementAlertBusinessSectors', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      recruitementAlertId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'RecruitementAlerts',
          key: 'id',
        },
      },
      businessSectorId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'BusinessSectors',
          key: 'id',
        },
      },
    });

    // Création de la table RecruitementAlertSkills (table de liaison)
    await queryInterface.createTable('RecruitementAlertSkills', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      recruitementAlertId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'RecruitementAlerts',
          key: 'id',
        },
      },
      skillId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'Skills',
          key: 'id',
        },
      },
    });

    // Ajout d'index pour améliorer les performances des recherches
    await queryInterface.addIndex('RecruitementAlertBusinessSectors', [
      'recruitementAlertId',
    ]);
    await queryInterface.addIndex('RecruitementAlertBusinessSectors', [
      'businessSectorId',
    ]);
    await queryInterface.addIndex('RecruitementAlertSkills', [
      'recruitementAlertId',
    ]);
    await queryInterface.addIndex('RecruitementAlertSkills', ['skillId']);
    await queryInterface.addIndex('RecruitementAlerts', ['companyId']);
  },

  async down(queryInterface, Sequelize) {
    // Suppression des tables dans l'ordre inverse de leur création
    await queryInterface.dropTable('RecruitementAlertSkills');
    await queryInterface.dropTable('RecruitementAlertBusinessSectors');

    // Suppression de l'enum après avoir supprimé la table qui l'utilise
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_RecruitementAlerts_contractType";'
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_RecruitementAlerts_workingExperienceYears";'
    );

    await queryInterface.dropTable('RecruitementAlerts');
  },
};
