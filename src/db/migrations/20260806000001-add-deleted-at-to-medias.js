'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // `Medias` had no soft-delete marker: a media row could only be hard-deleted,
    // which left no trace of the S3 object having been removed. `deletedAt` is
    // domain-agnostic here — it means "the underlying S3 object is gone".
    await queryInterface.addColumn('Medias', 'deletedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Medias', 'deletedAt');
  },
};
