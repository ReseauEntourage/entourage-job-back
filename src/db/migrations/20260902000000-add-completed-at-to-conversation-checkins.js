'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ConversationCheckins', 'completedAt', {
      allowNull: true,
      type: Sequelize.DATE,
    });

    await queryInterface.sequelize.query(
      `UPDATE "ConversationCheckins" SET "completedAt" = "updatedAt" WHERE "rating" IS NOT NULL`
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ConversationCheckins', 'completedAt');
  },
};
