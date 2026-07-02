export function createReporter({ level = "warn" } = {}) {
  return {
    report(componentName, message, context) {
      const text = `[${componentName}] ${message}`;

      switch (level) {
        case "silent":
          break;
        case "error":
          console.error(text, context ?? "");
          break;
        case "warn":
        default:
          console.warn(text, context ?? "");
      }

      return false;
    }
  }
}