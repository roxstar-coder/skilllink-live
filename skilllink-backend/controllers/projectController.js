const Project = require('../models/Project');
const User = require('../models/user');
const ProjectRequest = require('../models/ProjectRequest');
const Notification = require('../models/Notification');
const { notifyUser } = require('../utils/notifications');
const { saveMediaAsset, deleteMediaAssets } = require('../storage/mediaStorage');

exports.createProject = async (req, res) => {
    try {
        const { name, description, status, progress, requiredSkills, bannerMedia } = req.body;
        let savedBannerMedia = null;
        if (bannerMedia) {
            savedBannerMedia = await saveMediaAsset(bannerMedia, {
                folder: 'projects',
                allowedTypes: ['image']
            });
        }
        const newProject = new Project({
            user: req.user.userId,
            name,
            description,
            status,
            progress,
            requiredSkills,
            bannerMedia: savedBannerMedia,
            collaborators: []
        });
        await newProject.save();
        res.status(201).json({ message: 'Project created', project: newProject });
    } catch (error) {
        res.status(500).json({ message: 'Error creating project', error: error.message });
    }
};

exports.getProjects = async (req, res) => {
    try {
        const projects = await Project.find({ user: req.user.userId })
            .populate('user', 'name email profilePhoto')
            .populate('collaborators', 'name email location profilePhoto')
            .sort({ createdAt: -1 });
        res.json(projects);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching projects', error: error.message });
    }
};

exports.updateProject = async (req, res) => {
    try {
        const { name, description, status, progress, requiredSkills, bannerMedia } = req.body;
        const existingProject = await Project.findOne({ _id: req.params.id, user: req.user.userId });
        if (!existingProject) return res.status(404).json({ message: 'Project not found' });

        const updateData = { name, description, status, progress, requiredSkills };
        if (bannerMedia) {
            const savedBannerMedia = await saveMediaAsset(bannerMedia, {
                folder: 'projects',
                allowedTypes: ['image']
            });
            if (existingProject.bannerMedia) {
                await deleteMediaAssets([existingProject.bannerMedia]);
            }
            updateData.bannerMedia = savedBannerMedia;
        }

        const project = await Project.findOneAndUpdate(
            { _id: req.params.id, user: req.user.userId },
            { $set: updateData },
            { new: true }
        );
        if (!project) return res.status(404).json({ message: 'Project not found' });
        res.json({ message: 'Project updated', project });
    } catch (error) {
        res.status(500).json({ message: 'Error updating project', error: error.message });
    }
};

exports.deleteProject = async (req, res) => {
    try {
        const project = await Project.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
        if (!project) return res.status(404).json({ message: 'Project not found' });
        if (project.bannerMedia) {
            await deleteMediaAssets([project.bannerMedia]);
        }
        await Promise.all([
            ProjectRequest.deleteMany({ project: project._id }),
            Notification.deleteMany({ project: project._id }),
            User.updateMany({}, { $pull: { savedProjects: project._id } })
        ]);
        res.json({ message: 'Project deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting project', error: error.message });
    }
};

exports.getProjectRequests = async (req, res) => {
    try {
        const [incoming, outgoing] = await Promise.all([
            ProjectRequest.find({ owner: req.user.userId })
                .populate('requester', 'name email bio location profilePhoto')
                .populate('project', 'name description status progress requiredSkills collaborators bannerMedia')
                .sort({ createdAt: -1 }),
            ProjectRequest.find({ requester: req.user.userId })
                .populate('owner', 'name email bio location profilePhoto')
                .populate('project', 'name description status progress requiredSkills bannerMedia')
                .sort({ createdAt: -1 })
        ]);

        res.json({ incoming, outgoing });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching project requests', error: error.message });
    }
};

exports.requestToJoinProject = async (req, res) => {
    try {
        const requesterId = req.user.userId;
        const { message } = req.body;
        const project = await Project.findById(req.params.id).populate('user', 'name email profilePhoto');

        if (!project) return res.status(404).json({ message: 'Project not found' });
        if (String(project.user._id) === String(requesterId)) {
            return res.status(400).json({ message: 'You already own this project' });
        }
        if (project.collaborators.some(collaboratorId => String(collaboratorId) === String(requesterId))) {
            return res.status(400).json({ message: 'You are already part of this project' });
        }

        const existingPending = await ProjectRequest.findOne({
            project: project._id,
            requester: requesterId,
            status: 'pending'
        });

        if (existingPending) {
            return res.status(400).json({ message: 'Join request already sent' });
        }

        const projectRequest = await ProjectRequest.create({
            project: project._id,
            requester: requesterId,
            owner: project.user._id,
            message: message || ''
        });

        await projectRequest.populate('requester', 'name email bio location');
        await projectRequest.populate('project', 'name description status progress requiredSkills');

        await notifyUser(req, {
            recipient: project.user._id,
            actor: requesterId,
            project: project._id,
            projectRequest: projectRequest._id,
            type: 'project_request_received',
            title: 'New collaboration request',
            message: `${projectRequest.requester.name} wants to join "${project.name}".`,
            link: 'projects',
            eventName: 'projectRequestReceived',
            eventPayload: {
                message: `${projectRequest.requester.name} wants to join "${project.name}".`,
                request: projectRequest
            }
        });

        res.status(201).json({ message: 'Project join request sent', request: projectRequest });
    } catch (error) {
        res.status(500).json({ message: 'Error sending project request', error: error.message });
    }
};

exports.respondToProjectRequest = async (req, res) => {
    try {
        const { status, responseMessage } = req.body;
        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Status must be accepted or rejected' });
        }

        const projectRequest = await ProjectRequest.findOne({
            _id: req.params.requestId,
            owner: req.user.userId,
            status: 'pending'
        })
            .populate('requester', 'name email bio location profilePhoto')
            .populate('owner', 'name email bio location profilePhoto')
            .populate('project', 'name description status progress requiredSkills collaborators bannerMedia');

        if (!projectRequest) {
            return res.status(404).json({ message: 'Project request not found' });
        }

        if (status === 'accepted') {
            await Project.findByIdAndUpdate(projectRequest.project._id, {
                $addToSet: { collaborators: projectRequest.requester._id }
            });
        }

        projectRequest.status = status;
        projectRequest.responseMessage = responseMessage || '';
        projectRequest.respondedAt = new Date();
        await projectRequest.save();
        await projectRequest.populate('project', 'name description status progress requiredSkills collaborators bannerMedia');

        await notifyUser(req, {
            recipient: projectRequest.requester._id,
            actor: req.user.userId,
            project: projectRequest.project._id,
            projectRequest: projectRequest._id,
            type: status === 'accepted' ? 'project_request_accepted' : 'project_request_rejected',
            title: status === 'accepted' ? 'Collaboration request accepted' : 'Collaboration request updated',
            message: status === 'accepted'
                ? `${projectRequest.owner.name} accepted your request to join "${projectRequest.project.name}".`
                : `${projectRequest.owner.name} declined your request to join "${projectRequest.project.name}".`,
            link: 'projects',
            eventName: 'projectRequestUpdated',
            eventPayload: {
                message: status === 'accepted'
                    ? `${projectRequest.owner.name} accepted your request to join "${projectRequest.project.name}".`
                    : `${projectRequest.owner.name} declined your request to join "${projectRequest.project.name}".`,
                request: projectRequest
            }
        });

        res.json({
            message: status === 'accepted' ? 'Project request accepted' : 'Project request rejected',
            request: projectRequest
        });
    } catch (error) {
        res.status(500).json({ message: 'Error responding to project request', error: error.message });
    }
};
