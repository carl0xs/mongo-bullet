import { CommandStartedEvent, CommandSucceededEvent } from "mongodb";
import pino from "pino";
import pretty from "pino-pretty";

export type PendingCommand = {
  command: string;
  filter?: Record<string, unknown>;
  sort?: Record<string, unknown>;
  pipeline?: Record<string, unknown>[];
  collection: string;
};

type InitializeMongoBulletOptions = {
  connection: any;
  slowThreshold?: number;
};

const logger = pino(pretty({ sync: true }));

const DEFAULT_SLOW_THRESHOLD = 100;
const pendingCommands: Record<number, PendingCommand> = {};
const seen = new Set<string>();

const extractQueryFields = (data: PendingCommand) => {
  const matchFields = new Set<string>();
  const sortFields = new Set<string>();

  if (data.filter) {
    for (const key of Object.keys(data.filter)) {
      matchFields.add(key);
    }
  }

  if (data.sort) {
    for (const key of Object.keys(data.sort)) {
      sortFields.add(key);
    }
  }

  if (data.pipeline) {
    for (const stage of data.pipeline) {
      if (stage.$match) {
        for (const key of Object.keys(stage.$match)) {
          matchFields.add(key);
        }
      }

      if (stage.$sort) {
        for (const key of Object.keys(stage.$sort)) {
          sortFields.add(key);
        }
      }
    }
  }

  return {
    match: [...matchFields],
    sort: [...sortFields]
  };
};

const suggestIndexesFromHeuristics = (query: {
  match: string[];
  sort: string[];
  command: string;
}) => {
  const suggestions: Array<{ field: string; reason: string }> = [];

  for (const field of query.match) {
    suggestions.push({
      field,
      reason: "Field used in equality filter. Index generally reduces full scans."
    });
  }

  for (const field of query.sort) {
    suggestions.push({
      field,
      reason: "Field used in sorting. Index enables sort via index scan."
    });
  }

  if (query.command === "aggregate") {
    if (query.match.length > 0) {
      suggestions.push({
        field: query.match[0],
        reason: "The first stage of the pipeline is $match. Indices greatly accelerate pipelines."
      });
    }
  }

  return suggestions;
};


export const initializeMongoBullet = ({ 
  connection, 
  slowThreshold = DEFAULT_SLOW_THRESHOLD
}: InitializeMongoBulletOptions) => {

  logger.info("MongoBullet initialized.");

  connection.on("commandStarted", (event: CommandStartedEvent) => {
    const command = event.commandName;

    if (!["find", "aggregate", "update", "delete"].includes(command)) return;

    pendingCommands[event.requestId] = {
      command,
      filter: event.command?.filter,
      sort: event.command?.sort,
      pipeline: event.command?.pipeline,
      collection:
        event.command?.find ||
        event.command?.aggregate ||
        event.command?.update ||
        event.command?.delete
    };
  });

  connection.on("commandSucceeded", (event: CommandSucceededEvent) => {
    const data = pendingCommands[event.requestId];
    if (!data) return;
    delete pendingCommands[event.requestId];

    const duration = event.duration;
    if (duration < slowThreshold) return;

    const key = `${data.collection}:${data.command}:${duration}`;
    if (seen.has(key)) return;
    seen.add(key);

    const fields = extractQueryFields(data);
    const indexSuggestions = suggestIndexesFromHeuristics({
      match: fields.match,
      sort: fields.sort,
      command: data.command
    });

    logger.warn({
      type: "SLOW_QUERY",
      collection: data.collection,
      command: data.command,
      duration: `${duration}ms`,
      suggestedIndexes: indexSuggestions
    });
  });
};

