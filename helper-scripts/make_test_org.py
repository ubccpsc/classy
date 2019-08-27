## Creates a `classytest` organization on Github Enterprise and Github.com for CI test setup.

## INSTRUCTIONS:
## 1. Install pip packages: `pip3 install GitPython python-dotenv requests`
## 2. Run script AFTER entering GH_HOST and GH_API in .env file and follow prompts:
##      - run command from ./Classy dir: `python3 ./helper-scripts/make_test_org.py`

## If script errors part-way and you want to FORCE re-running the script all the way through without exiting on an error,
## comment out FAIL Exit() method in handle_response().

import requests
import time
import json
import git
import os
import getpass
import shutil
from pprint import pprint
from dotenv import load_dotenv

load_dotenv('./.env')

org_name = 'classytest'
api_token = ''
api_base_uri = os.getenv('GH_API')
github_enterprise = False
github_url = os.getenv('GH_HOST')
headers = ''
maintainer = ''
admin_team_members = ['classytest-admstaff', 'classytest-admin', 'classytest-bot01', 'classytest-bot02']
staff_team_members = ['classytest-admstaff', 'classytest-staff']
students_team_members = ['atest-04', 'atest-05', 'atest-06', 'atest-07', 'atest-08', 'atest-09', 'atest-10']

def get_y_or_n(question):
	answer = ''
	while answer != 'y' and answer != 'n':
		answer = input(question)
	if answer == 'y':
		return True
	if answer == 'n':
		return False

def handle_response(res, endpoint_url):
	if res.status_code >= 200 and res.status_code < 300:
		print('SUCCESS: ' + str(res.status_code) + ' on ' + endpoint_url)
	else:
		print('FAILURE: ' + str(res.status_code) + ' on ' + endpoint_url)
		print(res.json())
		exit(1)

def make_organization(org_name, maintainer):
	endpoint_url = api_base_uri + '/admin/organizations'
	data = dict(
		login=org_name,
		admin=maintainer,
		profile_name=org_name
		)
	res = requests.post(endpoint_url, json=data, headers=headers)
	handle_response(res, endpoint_url)

def create_repo(name, description):
	endpoint_url = api_base_uri + '/orgs/' + org_name + '/repos'
	data = {
		'name': name,
		'description': description,
		'private': False
	}
	res = requests.post(endpoint_url, json=data, headers=headers)
	handle_response(res, endpoint_url)

def create_team(team_name, team_members):
	endpoint_url = api_base_uri + '/orgs/' + org_name + '/teams'
	print(team_members)
	data = dict(
		name=team_name,
		maintainers=team_members,
		permission='pull'
		)
	res = requests.post(endpoint_url, json=data, headers=headers)
	handle_response(res, endpoint_url)

def add_org_members(org_members, role):
	endpoint_url = api_base_uri + '/orgs/' + org_name + '/memberships/'
	data = dict(
		role=role
		)
	for member in org_members:
		response = requests.put(endpoint_url + member, json=data, headers=headers)
		handle_response(response, endpoint_url)


## PRE-SCRiPT RUN
print('''This script will setup a `classytest` organization for CI testing.
	IMPORTANT: Github.com public requires that you manually create a `classytest` organization and enter an API key with owner permissions.
	Github Enterprise will create the `classytest` organization automatically. This requires that you enter an API key with Github Admin permissions''')
print('To proceed, enter your organization owner API key Github Admin permissions: ')
api_token = getpass.getpass()
github_enterprise = get_y_or_n('Are you using a Github Enterprise instance? (y/n): ')
headers = {'Content-Type': 'application/json',
			'Authorization': f'token {api_token}'}

## 1. Make Organization
if github_enterprise:
	while maintainer == '':
		maintainer = input('Enter your organization maintainer username: ').lower().strip()
	make_organization(org_name, maintainer)

## 2. Add users to organization
if github_enterprise == False:
	proceed = get_y_or_n('Github.com public REQUIRES that team members accept an organization invite before being added to the team. Do you want to proceed with ' +
		f'inviting admin, staff, and students testing accounts to {org_name} on {github_url}? (y/n): ')
	if proceed == False:
		exit()

add_org_members(admin_team_members, 'admin')
add_org_members(staff_team_members, 'member')
add_org_members(students_team_members, 'member')

## 3. Add users to teams
if github_enterprise == False:
	proceed = get_y_or_n('Github users have been invited to your organization. Before you can proceed to add users to a team, they MUST accept your invitiation. ' +
			'Do you want to proceed with adding users to the admin, staff, and students teams? (y/n): ')
	if proceed == False:
		exit()

create_team('admin', admin_team_members)
create_team('staff', staff_team_members)
create_team('students', students_team_members)

## 4. Create empty repos used in CI testing
create_repo('PostTestDoNotDelete', 'Tests the AutoTest bot can comment code to a repository')
create_repo('TESTING_SAMPLE_REPO', 'To test that the AutoTest bot can successfully clone a repo with its files')

## 5. Copy base repo code to empty repos
postTestBaseRepo = git.Repo.clone_from('https://github.students.cs.ubc.ca/classytest/PostTestDoNotDelete.git', os.path.join('./helper-scripts/', 'PostTestDoNotDelete'))
postTestBaseRepo.delete_remote('origin')
postTestBaseRepo.create_remote('origin', github_url + '/' + org_name + '/PostTestDoNotDelete.git')
postTestBaseRepo.git.push('origin', 'master')

cloneTestBaseRepo = git.Repo.clone_from('https://github.students.cs.ubc.ca/classytest/TESTING_SAMPLE_REPO.git', os.path.join('./helper-scripts/', 'TESTING_SAMPLE_REPO'))
cloneTestBaseRepo.delete_remote('origin')
cloneTestBaseRepo.create_remote('origin', github_url + '/' + org_name + '/TESTING_SAMPLE_REPO.git')
cloneTestBaseRepo.git.push('origin', 'master')

## POST-SCRIPT RUN
shutil.rmtree('./helper-scripts/PostTestDoNotDelete')
shutil.rmtree('./helper-scripts/TESTING_SAMPLE_REPO')

print('Organization setup complete')
exit()


