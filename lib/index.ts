import pino from "pino";
import pretty from "pino-pretty";

const logger = pino(pretty({ sync: true }));

const SLOW_THRESHOLD = 100;
const pendingCommands: Record<number, any> = {};
const seen = new Set<string>();

const extractQueryFields = (data: any) => {
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


export const initializeMongoBullet = (connection: any) => {
  logger.info("===== Mongo bullet started =====");

  connection.on("commandStarted", (event: any) => {
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

  connection.on("commandSucceeded", (event: any) => {
    const data = pendingCommands[event.requestId];
    if (!data) return;
    delete pendingCommands[event.requestId];

    const duration = event.duration;
    if (duration < SLOW_THRESHOLD) return;

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

