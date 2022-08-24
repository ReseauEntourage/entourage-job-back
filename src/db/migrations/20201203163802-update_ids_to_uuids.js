const tablesToModify = [
  'CV_Ambitions',
  'CV_Contracts',
  'CV_Languages',
  'CV_Passions',
  'CV_Skills',
  'Experience_Skills',
  'Opportunity_BusinessLines',
  'Opportunity_Users',
];

module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all(
      tablesToModify.map((tableName) => {
        return queryInterface
          .addColumn(tableName, 'newId', {
            type: Sequelize.UUID,
            unique: true,
            primaryKey: true,
            allowNull: false,
            defaultValue: Sequelize.literal('uuid_generate_v4()'),
          })
          .then(() => {
            return queryInterface.removeColumn(tableName, 'id').then(() => {
              return queryInterface.renameColumn(tableName, 'newId', 'id');
            });
          });
      })
    );
  },

  down: (queryInterface, Sequelize) => {
    return Promise.all(
      tablesToModify.map((tableName) => {
        return queryInterface
          .addColumn(tableName, 'oldId', {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
          })
          .then(() => {
            return queryInterface.removeColumn(tableName, 'id').then(() => {
              return queryInterface.renameColumn(tableName, 'oldId', 'id');
            });
          });
      })
    );
  },
};
