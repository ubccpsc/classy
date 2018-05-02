export default class Util {

    public static timeout(ms: number): Promise<void> {
        return new Promise<void>((resolve) => setTimeout(resolve, ms));
    }

    public static took(start: number): string {
        return Date.now() - start + " ms";
    }
}
