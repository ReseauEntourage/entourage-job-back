'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Ajout de la colonne logoUrl à la table Companies
     */
    await queryInterface.addColumn('Companies', 'logoUrl', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });

    /**
     * Ajout de la colonne goal à la table Companies
     */
    await queryInterface.addColumn('Companies', 'goal', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });

    /**
     * Ajout de la colonne departmentId à la table Companies
     */
    await queryInterface.addColumn('Companies', 'departmentId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Departments',
        key: 'id',
      },
    });

    /**
     * Suppression de la colonne businessSectorId de la table Companies
     */
    await queryInterface.removeColumn('Companies', 'businessSectorId');

    /**
     * Création de la table de liaison CompanyBusinessSectors
     */
    await queryInterface.createTable('CompanyBusinessSectors', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      companyId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'Companies',
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('CompanyBusinessSectors');

    /**
     * Suppression de la colonne departmentId de la table Companies
     */
    await queryInterface.removeColumn('Companies', 'departmentId');

    /**
     * Suppression de la colonne logoUrl de la table Companies
     */
    await queryInterface.removeColumn('Companies', 'logoUrl');

    /**
     * Suppression de la colonne goal de la table Companies
     */
    await queryInterface.removeColumn('Companies', 'goal');

    /**
     * Suppression de la colonne businessSectorId de la table Companies
     */
    await queryInterface.addColumn('Companies', 'businessSectorId', {
      allowNull: true,
      type: Sequelize.UUID,
      references: {
        model: 'BusinessSectors',
        key: 'id',
      },
    });
  },
};
