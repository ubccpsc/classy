import Log from "@common/Log";

import {AdminDashboardTab} from "@frontend/views/AdminDashboardTab";
import {AdminResultsTab} from "@frontend/views/AdminResultsTab";

/**
 * Course-specific versions of the admin Results and Dashboard tabs.
 *
 * The base tabs expose a few protected hooks so a course can change what a row shows without
 * re-implementing the render loop: buildRepoOptions(), personFilter(), buildHeaders(),
 * decorateRow(), and adminLink(). This example overrides adminLink(), which decides the href an
 * instructor's table shows for a record URL. The default is the URL as stored; core never rewrites.
 *
 * The rewrite shown here is the one that motivated the hook. Results from an external grader are
 * often stored with the STUDENT link to a submission (so the student can open it from their grades
 * page); an instructor following the same link lands on the student-facing page. PrairieLearn is
 * one such grader: its instructor view is the student link with "instructor/" inserted. The regex
 * below does exactly that and returns every other URL as given, so it is safe to apply to every
 * link in the table. It is deliberately self-contained -- a plugin should carry its own course
 * logic, not depend on Classy for it.
 *
 * To use these, CustomAdminView assigns them over the stock tabs after calling super(); see there.
 * Naming follows the plugin convention (CustomAdminView, CustomStudentView).
 */
function instructorLink(url: string): string {
    if (typeof url !== "string") {
        return url;
    }
    return url.replace(/(\/pl\/course_instance\/\d+\/)assessment_instance\//, "$1instructor/assessment_instance/");
}

export class CustomResultsTab extends AdminResultsTab {
    protected adminLink(url: string): string {
        return instructorLink(url);
    }
}

export class CustomDashboardTab extends AdminDashboardTab {
    protected adminLink(url: string): string {
        return instructorLink(url);
    }
}

Log.trace("CustomAdminTabs - loaded");
