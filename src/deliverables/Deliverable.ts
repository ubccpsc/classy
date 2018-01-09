import Container from "../Container";

export interface IRunReport {
    scoreOverall: number;
    scoreTest: number;
    scoreCover: number;
    passNames: string[];
    failNames: string[];
    errorNames: string[];
    skipNames: string[];
    custom: any[];
    feedback: string;
    code: number;
}

export interface ITestNames {
    pass: string[];
    fail: string[];
    skip: string[];
}

export default abstract class Deliverable {

    protected static extractTestNames(report: any, testNameDelimiter?: string): ITestNames {
        const testNames: ITestNames = {
            fail: [],
            pass: [],
            skip: [],
        };

        const suites = report.suites.suites;
        const tests: any[] = suites.map((suite: any) => {
          return suite.tests;
        }).reduce((acc: any, cur: any) => acc.concat(cur), []);

        testNames.pass = tests.filter((test: any) => {
          return test.pass;
        }).map((name: any) => {
          const fullName = name.fullTitle;
          if (testNameDelimiter) {
            return fullName.substring(fullName.indexOf(testNameDelimiter) + 1, fullName.lastIndexOf(testNameDelimiter));
          } else {
            return fullName;
          }
        });

        testNames.fail = tests.filter((test: any) => {
          return test.fail;
        }).map((name: any) => {
          const fullName = name.fullTitle;
          if (testNameDelimiter) {
            return fullName.substring(fullName.indexOf(testNameDelimiter) + 1, fullName.lastIndexOf(testNameDelimiter));
          } else {
            return fullName;
          }
        });

        testNames.skip = [].concat.apply([], suites.filter((suite: any) => {
          return suite.hasSkipped;
        }).map((suite: any) => {
          return suite.skipped.map((skippedTest: any) => {
            const fullName = skippedTest.fullTitle;
            if (testNameDelimiter) {
              return fullName.substring(fullName.indexOf(testNameDelimiter) + 1,
                                        fullName.lastIndexOf(testNameDelimiter));
            } else {
              return fullName;
            }
          });
        }));

        return testNames;
    }

    // If this method throws and exception, the message will be treated as the feedback
    public abstract run(container: Container): Promise<IRunReport>;
}
