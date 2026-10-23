'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Text produced by the reading pass of the CV extraction. Nullable: the
      // single-call extraction does not produce it, and rows saved before this
      // change do not have it
      await queryInterface.addColumn(
        'ExtractedCVData',
        'transcript',
        { allowNull: true, type: Sequelize.TEXT },
        { transaction }
      );
      // Version of the reading instructions that produced the text: a text read
      // with older instructions is not reused
      await queryInterface.addColumn(
        'ExtractedCVData',
        'transcriptVersion',
        { allowNull: true, type: Sequelize.INTEGER },
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn('ExtractedCVData', 'transcriptVersion', {
        transaction,
      });
      await queryInterface.removeColumn('ExtractedCVData', 'transcript', {
        transaction,
      });
    });
  },
};
