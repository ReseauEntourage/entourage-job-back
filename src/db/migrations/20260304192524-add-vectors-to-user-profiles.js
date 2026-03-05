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
    await queryInterface.addIndex(
      'UserProfileEmbeddings',
      ['userProfileId', 'type'],
      {
        name: 'user_profile_embeddings_user_profile_id_type',
      }
    );

    // Add a HNSW index on the embedding column for efficient similarity search
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS user_profile_embeddings_embedding_hnsw_idx ON "UserProfileEmbeddings" USING hnsw (embedding vector_cosine_ops);'
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS user_profile_embeddings_embedding_hnsw_idx;'
    );
    await queryInterface.removeIndex(
      'UserProfileEmbeddings',
      'user_profile_embeddings_user_profile_id_type'
    );
    await queryInterface.dropTable('UserProfileEmbeddings');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_UserProfileEmbeddings_type";'
    );
  },
};
