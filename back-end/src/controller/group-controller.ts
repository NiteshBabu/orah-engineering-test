import { NextFunction, Request, Response } from "express"
import { getRepository } from "typeorm"
import { GroupStudent } from "../entity/group-student.entity"
import { Group } from "../entity/group.entity"
import { Roll } from "../entity/roll.entity"
import { StudentRollState } from "../entity/student-roll-state.entity"
import { Student } from "../entity/student.entity"
import { CreateGroupInput, UpdateGroupInput } from "../interface/group.interface"

export class GroupController {
  private groupRepository = getRepository(Group)
  private groupStudentRepository = getRepository(GroupStudent)
  private studentRepository = getRepository(Student)
  private rollRepository = getRepository(Roll)
  private studetnRollRepository = getRepository(StudentRollState)

  async allGroups(request: Request, response: Response, next: NextFunction) {
    // Task 1:
    // Return the list of all groups
    return this.groupRepository.find()
  }

  async createGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1:
    const { body: params } = request

    const createGroupInput: CreateGroupInput = {
      name: params.name,
      number_of_weeks: params.number_of_weeks,
      roll_states: params.roll_states,
      incidents: params.incidents,
      ltmt: params.ltmt,
      run_at: params.run_at,
      student_count: params.student_count,
    }

    // Add a Group
    const group = new Group()
    group.prepareToCreate(createGroupInput)
    return this.groupRepository.save(group)
  }

  async updateGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1:
    const { body: params } = request

    // Update a Group
    const group = await this.groupRepository.findOne(params.id)

    if (group === undefined) return response.json({ body: "Not Found" })

    const updateGroupInput: UpdateGroupInput = {
      name: params.name,
      number_of_weeks: params.number_of_weeks,
      roll_states: params.roll_states,
      incidents: params.incidents,
      ltmt: params.ltmt,
      run_at: params.run_at,
      student_count: params.student_count,
    }

    group.prepareToUpdate(updateGroupInput)

    return this.groupRepository.save(group)
  }

  async removeGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1:
    const { body: params } = request

    // Delete a Group

    const group = await this.groupRepository.findOne(params.id)
    if (group === undefined) return response.json({ body: "Not Found" })

    return this.groupRepository.remove(group)
  }

  async getGroupStudents(request: Request, response: Response, next: NextFunction) {
    // Task 1:
    const { body: params } = request
    const groupStudents = await this.groupStudentRepository.find({ group_id: params.group_id })

    if (!groupStudents) return {body : "Not Found"}

    let promises = groupStudents.map((s) =>
      this.studentRepository.findOne({ id: s.student_id }).then((student) => {
        return {
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          full_name: `${student.first_name} ${student.last_name}`,
        }
      })
    )
    // Return the list of Students that are in a Group
    return await Promise.all(promises)
  }

  async runGroupFilters(request: Request, response: Response, next: NextFunction) {
    // Task 2:

    // 1. Clear out the groups (delete all the students from the groups)
    this.groupStudentRepository.find().then((studentGroup) => this.groupStudentRepository.remove(studentGroup))

    // 2. For each group, query the student rolls to see which students match the filter for the group
    const group = await this.groupRepository.findOne({ id: request.query.id })
    if (!group) return { body: "Not Found" }

    let date = new Date()
    group.run_at = date

    date.setDate(date.getDate() - group.number_of_weeks * 7)

    // fetch roll state, matching group's roll_states
    const rollStatesName = group.roll_states.split(",").map((s) => s.trim())

    const rollStates = await this.rollRepository
      .createQueryBuilder("roll")
      .where("roll.name IN (:...names)", { names: rollStatesName })
      .andWhere("roll.completed_at > :date", { date: date })
      .getMany()

    // fetch students present with same roll state
    const studentsInRollState = await this.studetnRollRepository
      .createQueryBuilder("student")
      .where("student.roll_id IN (:...ids)", { ids: rollStates.map((s) => s.id) })
      .getMany()

    // No. of students matching filter

    // 3. Add the list of students that match the filter to the group
    let seen: number = null
    const studentCount: number[] = []
    studentsInRollState.map(async (s) => {
      if (!seen) {
        seen = s.student_id
        this.insertIntoGroupStudent(group, studentsInRollState, s, studentCount)
      }
      if (seen != s.student_id) {
        seen = s.student_id
        this.insertIntoGroupStudent(group, studentsInRollState, s, studentCount)
      }
    })

    group.student_count = studentCount.length
    return this.groupRepository.save(group)
  }

  // helper function to insert into group-student
  public insertIntoGroupStudent(group: Group, studentsInRollState: StudentRollState[], student: StudentRollState, studentCount: number[]) {
    const count = studentsInRollState.filter((x) => student.student_id === x.student_id).length
    if (group.ltmt === "<" && count < group.incidents) {
      studentCount.push(0)
      const groupStudent = new GroupStudent()
      groupStudent.prepareToCreate({
        student_id: student.student_id,
        group_id: group.id,
        incident_count: count,
      })
      this.groupStudentRepository.save(groupStudent)
    }
    if (group.ltmt === ">" && count > group.incidents) {
      studentCount.push(0)
      const groupStudent = new GroupStudent()
      groupStudent.prepareToCreate({
        student_id: student.student_id,
        group_id: group.id,
        incident_count: count,
      })
      this.groupStudentRepository.save(groupStudent)
    }
  }
}
