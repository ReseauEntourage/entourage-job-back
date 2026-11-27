'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Set once when the user closes the donation block of the dashboard for
    // good. Nullable and without backfill: everyone eligible sees the block
    // until they close it.
    await queryInterface.addColumn('Users', 'donationBlockDismissedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'donationBlockDismissedAt');
  },
};
