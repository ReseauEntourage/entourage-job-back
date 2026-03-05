'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('UserProfileEmbeddings', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
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
      userProfileId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'UserProfiles',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM('profile', 'needs'),
        allowNull: false,
      },
      embedding: {
        type: 'vector(1536)',
        allowNull: false,
      },
      configVersion: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
    });

    // Add an index on userProfileId and type for faster querying
    await queryInterface.addIndex('UserProfileEmbeddings', [
      'userProfileId',
      'type',
    ]);

    // Add a HNSW index on the embedding column for efficient similarity search
    await queryInterface.sequelize.query(
      'CREATE INDEX user_profile_embeddings_embedding_hnsw_idx ON "UserProfileEmbeddings" USING hnsw (embedding);'
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('UserProfileEmbeddings');
  },
};
