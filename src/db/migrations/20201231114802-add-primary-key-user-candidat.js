module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface
      .removeConstraint('User_Candidats', 'User_Candidats_pkey')
      .then(() => {
        return queryInterface
          .addColumn('User_Candidats', 'id', {
            type: Sequelize.UUID,
            unique: true,
            allowNull: false,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          })
          .then(() => {
            return queryInterface.addConstraint('User_Candidats', {
              fields: ['id'],
              type: 'primary key',
              name: 'User_Candidats_pkey',
            });
          });
      });
  },
  down: (queryInterface) => {
    return queryInterface
      .removeConstraint('User_Candidats', 'User_Candidats_pkey')
      .then(() => {
        return queryInterface
          .addConstraint('User_Candidats', {
            fields: ['candidatId'],
            type: 'primary key',
            name: 'User_Candidats_pkey',
          })
          .then(() => {
            return queryInterface.removeColumn('User_Candidats', 'id');
          });
      });
  },
};
