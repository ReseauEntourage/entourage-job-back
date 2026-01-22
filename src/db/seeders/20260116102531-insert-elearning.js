'use strict';

const uuid = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const elearningUnitsIds = [uuid.v4(), uuid.v4(), uuid.v4(), uuid.v4()];
    await queryInterface.bulkInsert('ElearningUnits', [
      {
        id: elearningUnitsIds[0],
        title: 'Comprendre mon rôle de coach sur Entourage Pro',
        description:
          'Cette vidéo explique le rôle des coachs sur la plateforme Entourage Pro.',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        durationMinutes: 10,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: elearningUnitsIds[1],
        title: 'Comprendre mon rôle de candidat sur Entourage Pro',
        description:
          'Cette vidéo explique le rôle des candidats sur la plateforme Entourage Pro.',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        durationMinutes: 10,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: elearningUnitsIds[2],
        title: "Utiliser les outils d'Entourage Pro",
        description:
          'Cette vidéo présente les différents outils disponibles sur la plateforme Entourage Pro.',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        durationMinutes: 15,
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await queryInterface.bulkInsert('ElearningUnitRoles', [
      // Unit 0 for Coach role
      {
        id: uuid.v4(),
        unitId: elearningUnitsIds[0],
        role: 'Coach',
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // Unit 1 for Candidat role
      {
        id: uuid.v4(),
        unitId: elearningUnitsIds[1],
        role: 'Candidat',
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // Unit 2 for both roles
      {
        id: uuid.v4(),
        unitId: elearningUnitsIds[2],
        role: 'Coach',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuid.v4(),
        unitId: elearningUnitsIds[2],
        role: 'Candidat',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const elearningQuestionsIds = [
      uuid.v4(),
      uuid.v4(),
      uuid.v4(),
      uuid.v4(),
      uuid.v4(),
    ];
    await queryInterface.bulkInsert('ElearningQuestions', [
      {
        id: elearningQuestionsIds[0],
        unitId: elearningUnitsIds[0],
        label: 'Quel est le rôle principal d’un coach sur Entourage Pro ?',
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: elearningQuestionsIds[1],
        unitId: elearningUnitsIds[0],
        label: 'Comment un coach peut-il aider un candidat ?',
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: elearningQuestionsIds[2],
        unitId: elearningUnitsIds[1],
        label: 'Quel est le rôle principal d’un candidat sur Entourage Pro ?',
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: elearningQuestionsIds[3],
        unitId: elearningUnitsIds[1],
        label:
          'Comment un candidat peut-il maximiser ses chances de trouver un emploi ?',
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: elearningQuestionsIds[4],
        unitId: elearningUnitsIds[2],
        label:
          'Quels outils sont disponibles sur Entourage Pro pour les utilisateurs ?',
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await queryInterface.bulkInsert('ElearningAnswers', [
      // Answers for Unit 0 Questions
      {
        id: uuid.v4(),
        questionId: elearningQuestionsIds[0],
        label: 'Accompagner les candidats dans leur recherche d’emploi',
        isCorrect: true,
        explaination:
          'Le rôle principal d’un coach est d’accompagner les candidats.',
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuid.v4(),
        questionId: elearningQuestionsIds[0],
        label: 'Publier des offres d’emploi',
        isCorrect: false,
        explaination:
          "Publier des offres d’emploi n'est pas le rôle principal d’un coach.",
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuid.v4(),
        questionId: elearningQuestionsIds[1],
        label: 'En les guidant et en leur fournissant des ressources',
        explaination: 'Un coach aide un candidat en le guidant.',
        isCorrect: true,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuid.v4(),
        questionId: elearningQuestionsIds[1],
        label: 'En leur trouvant directement un emploi',
        explaination:
          "Un coach n'est pas responsable de trouver un emploi pour le candidat.",
        isCorrect: false,
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // Answers for Unit 1 Questions
      {
        id: uuid.v4(),
        questionId: elearningQuestionsIds[2],
        label: 'Rechercher activement des opportunités d’emploi',
        isCorrect: true,
        explaination:
          'Le rôle principal d’un candidat est de rechercher des opportunités.',
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuid.v4(),
        questionId: elearningQuestionsIds[2],
        label: 'Coacher d’autres candidats',
        isCorrect: false,
        explaination:
          "Coacher d’autres candidats n'est pas le rôle principal d’un candidat.",
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuid.v4(),
        questionId: elearningQuestionsIds[3],
        label:
          'En utilisant les ressources et le soutien disponibles sur la plateforme',
        explaination:
          'Un candidat peut maximiser ses chances en utilisant les ressources et le soutien disponibles sur la plateforme.',
        isCorrect: true,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuid.v4(),
        questionId: elearningQuestionsIds[3],
        label: 'En attendant que les offres d’emploi arrivent',
        explaination:
          'Un candidat ne doit pas simplement attendre que les offres d’emploi arrivent.',
        isCorrect: false,
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // Answers for Unit 2 Question
      {
        id: uuid.v4(),
        questionId: elearningQuestionsIds[4],
        label: 'Tableau de bord, messagerie, et ressources de formation',
        isCorrect: true,
        explaination:
          'Les outils disponibles incluent le tableau de bord, la messagerie, et les ressources de formation.',
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuid.v4(),
        questionId: elearningQuestionsIds[4],
        label: 'Jeux en ligne',
        isCorrect: false,
        explaination:
          'Les jeux en ligne ne sont pas des outils disponibles sur la plateforme.',
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    // No need to implement the down function for seeders
  },
};
