import { RegisterQueueOptions } from '@nestjs/bullmq';
import { QueuePriority, Queues } from './queues.types';

export function getBullWorkQueueOptions(): RegisterQueueOptions {
  return {
    name: Queues.WORK,
    defaultJobOptions: {
      attempts: `${process.env.JOBS_NB_ATTEMPS}`
        ? parseInt(process.env.JOBS_NB_ATTEMPS)
        : 10,
      backoff: {
        type: 'exponential',
        delay: `${process.env.JOBS_BACKOFF_DELAY}`
          ? parseInt(process.env.JOBS_BACKOFF_DELAY, 10)
          : 60000,
      },
      removeOnFail: false,
      removeOnComplete: true,
      priority: QueuePriority.NORMAL, // Priorité normale pour les tâches de travail, elles sont importantes mais n'ont pas besoin d'être traitées immédiatement
    },
  };
}

export function getBullProfileGenerationQueueOptions(): RegisterQueueOptions {
  return {
    name: Queues.PROFILE_GENERATION,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 10000,
      },
      removeOnFail: false, // Garder les jobs échoués pour inspection
      removeOnComplete: true,
      priority: QueuePriority.HIGH, // Priorité élevée pour les tâches de génération de profil, les utilisateurs attendent un résultat rapide
    },
  };
}

export const getBullCronTasksQueueOptions = (): RegisterQueueOptions => {
  return {
    name: Queues.CRON_TASKS,
    defaultJobOptions: {
      attempts: 1, // Pas de tentative de retry pour les tâches cron, elles seront réessayées à la prochaine exécution planifiée
      removeOnFail: false, // Garder les jobs échoués pour inspection
      removeOnComplete: true,
      priority: QueuePriority.LOW, // Priorité basse pour les tâches cron, elles sont importantes mais peuvent être traitées après les autres tâches
    },
  };
};

export const getEmbeddingQueueOptions = (): RegisterQueueOptions => {
  return {
    name: Queues.EMBEDDING,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 10000,
      },
      removeOnFail: false,
      removeOnComplete: true,
      priority: QueuePriority.NORMAL,
    },
  };
};
