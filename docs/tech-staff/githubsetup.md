# Github Setup

*Classy is integrated with Github.com or Github Enterprise to provide interactive and gamified learning experienced for students. When a student pushes code to a Github repository, Classy gives feedback and a grade to the student. Classy, therefore, requires the appropriate permissions to access and interact with a student repository.*

## Configure Github

## Debug Github

ERROR: Invalid Classy Credentials

<img src="../docs/assets/invalid-classy-credentials.png>

*If you, or all students, are experiencing this error, then Classy cannot find a user in the admin, student, or staff groups on Github. *

How to Debug:

    1. Login to Github through the UI.
    2. Visibly inspect the organization teams to confirm that the CWL user(s) who is experiencing this error has been added to an **admin**, **staff**, or **students** team.
      a. If an admin user is missing, add them manually.
      b. If a staff or student user is missing, contact Michael Sanderson to determine why they are missing. He should fix it, as users will automatically be removed from the staff and admin teams if they are not in the class list registry. 

     After adding the user(s) to the appropriate team, reload the view to see if the issue is fixed, **OR** continue to the next debug step.

    3. If the CWL user has been added to a team, but this error persists, it is likely that Classy does not have permission to read the team to see what users exist underneath it.

Reload the view after each of these steps to see if the issue is fixed:

a) Ensure that the **GH_BOT_TOKEN** in the **/opt/classy/.env** file is configured with a token in the format `token longStringSHAHere`. `token ` must precede the `longStringSHAHere` value.
b) If a token is configured, ensure that the token is from a Github user that has access to the teams and organization. An owner privilege is required for the bot.
c) If you cannot trace the token, configure a new token under the Github user settings **Github Developer** page.

### Classy UI - Expected Behaviour

A user who logs into Classy should be met with a Student, Staff, or Admin view with icon tabs across the main page after logging in.

Login screen → Github OAuth Login Page (CWL background integration) → Screenshots of Student/Staff/Admin views.

    1. Go to Classy service website (ie. https://classy-dev.students.ubc.ca):

    <img src="../docs/assets/classy-management-portal.png>

    1. Go to Github Login page if NOT already authenticated on Github Enterprise website (you may have to accept agreement on additional page):

    <img src="../docs/assets/enterprise-login-portal.png">

    1. See the students, staff, or admin page depending on user permissions:

    <img src="../docs/assets/classy-logged-in.png">

## Integrate Github

### OAuth Github Enterprise/Classy Integration

A student can login to Classy by entering their CWL username password and credentials because Classy is integrated with Github Enterprise and Github is integrated with LDAP (aka. CWL usernames).

OAuth configuration is set in the **/opt/classy/.env** file by configuration two OAuth credential values.

How To Produce OAuth Credentials:

    1. Login as an owner of the organization.

    <img src="../docs/assets/organization-profile.png">

    2. Click on the organization settings.

    <img src="../docs/assets/organization-profile.png">

    3. Click on OAuth Apps under the Developer Settings side-panel.

    <img src="../docs/assets/oauth-application-credentials.png">

*The two blue fields are intentionally removed. The Client ID and Client Secret must be entered into the /opt/classy/.env environment properties.*

**NOTE**: CWL and Github.com integrations are NOT compatible. If Classy is integrated with Github.com instead of Github Enterprise, real Github users are required.

### Adding Students and Staff to Github Organization

At the moment, **students** and **staff** are automatically added to the appropriate Github organization teams for a specific course. Contact Michael Sanderson each time a Classy configuration is setup for a class to verify that students for that course will automatically be added the appropriate Github organization. Michael Sanderson has implemented logic to continuously update the organization teams with the current class list registry. If a student drops the course, the student will automatically be removed by his logic.

### Adding Admins to Github Organization

Admins must be manually added to an organization team by an owner of the organization. Admin examples are course instructors, assistants (not TAs unless instructed by the course instructor), and technical staff from our department. There is no automated logic to add admin users in a Github organization anywhere. Github organization owners and Github admins have permission to add a user to the admin team.

### Adding User as Github Organization Owner

Github admins and owners of an organization may grant a user owner permissions of an organization.


### Github Tokens

Two Github tokens may be added to the Classy environmental configuration file. The Classy Bot Token is mandatory and the Docker AutoGrade Token is optional.

#### Classy Bot Token Steps

- Login as the bot name decided for the course (AutoBot is the standard user unless requested by instructor)
- Click on the user settings icon and click on Developer Settings.
- Click on Personal Tokens side-panel option.
- Under the Personal Tokens view, you will have the option to generate a new token or configure re-generate a pre-configured token.

WARNING: IF you decide to regenerate a pre-configured token, but the token is being used by another Classy server, you will break the course until a token is updated in the .env file for that course instance. If you lose track of the tokens, the safest way forward is to generate a new token, until the problem can be fixed at the end of the next semester.

TO DO: Screenshot of the Github access permissions for the token.

#### Docker AutoGrade Token Steps

**WARNING**: Classy can **ONLY** have one **GH_DOCKER_TOKEN** configured in the **/opt/classy/.env** file. If a course has multiple instructors who each would like to build an AutoGrade docker container to mark their assignments, they **MUST** share the token. Hence, the token should be generated from an user level that has permission to all of their AutoGrade container Github repositories. See [Instructor AutoGrade Creation Manual](/docs/instructor/autograde.md#overview) for more information on how to clone AutoGrade container repositories.

- Login as user with permissions to view the AutoGrade repository when it is private.
- Repeat the steps from [Classy Bot Token](#classy-bot-token-steps) generation above.

TO DO: Screenshot of the Github access permissions for the token.

<TO DO: Details on how the enviornmental config file should be updated should be included when you have your repository, users, and API keys created>
# Github Setup

