'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Messages', 'type', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'USER',
    });
    await queryInterface.changeColumn('Messages', 'authorId', {
      type: Sequelize.UUID,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // SERVICE messages (see 20260828000000-add-service-message-fields-to-messages.js)
    // have authorId = null, which would violate the NOT NULL constraint being restored
    // below. Delete them first so the rollback doesn't fail once any exist.
    await queryInterface.sequelize.query(
      'DELETE FROM "Messages" WHERE "authorId" IS NULL'
    );
    await queryInterface.changeColumn('Messages', 'authorId', {
      type: Sequelize.UUID,
      allowNull: false,
    });
    await queryInterface.removeColumn('Messages', 'type');
  },
};
