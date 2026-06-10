import { Router, Request, Response } from 'express';
import Club, { IClub } from '../models/Club.model';
import Member from '../models/Member.model';

const router = Router();

// GET /api/clubs - 클럽 목록 조회
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, city, isActive, limit = 50, offset = 0 } = req.query;

    const filter: any = {};
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }
    if (city) {
      filter['location.city'] = city;
    }
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const clubs = await Club.find(filter)
      .limit(Number(limit))
      .skip(Number(offset))
      .populate('createdBy', 'name')
      .select('-members');

    const total = await Club.countDocuments(filter);

    return res.status(200).json({
      clubs,
      total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch clubs', details: (error as Error).message });
  }
});

// GET /api/clubs/:id - 클럽 상세 조회
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const club = await Club.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('members', 'name elo level profileImage');

    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    return res.status(200).json(club);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch club', details: (error as Error).message });
  }
});

// POST /api/clubs - 클럽 생성
router.post('/', async (req: Request, res: Response) => {
  try {
    const clubData: Partial<IClub> = req.body;

    // 필수 필드 검증
    if (!clubData.name) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!clubData.createdBy) {
      return res.status(400).json({ error: 'createdBy is required' });
    }

    // 생성자 존재 확인
    const creator = await Member.findById(clubData.createdBy);
    if (!creator) {
      return res.status(404).json({ error: 'Creator member not found' });
    }

    // 중복 이름 체크
    const existing = await Club.findOne({ name: clubData.name });
    if (existing) {
      return res.status(409).json({ error: 'Club with this name already exists' });
    }

    const club = new Club(clubData);
    await club.save();

    await club.populate('createdBy', 'name email');

    return res.status(201).json(club);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create club', details: (error as Error).message });
  }
});

// PUT /api/clubs/:id - 클럽 정보 수정
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updates = req.body;

    // 민감한 필드는 직접 수정 불가
    delete updates.members;
    delete updates.memberCount;
    delete updates.stats;
    delete updates.createdBy;
    delete updates.createdAt;
    delete updates.updatedAt;

    const club = await Club.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate('createdBy', 'name');

    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    return res.status(200).json(club);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update club', details: (error as Error).message });
  }
});

// POST /api/clubs/:id/members - 클럽에 회원 추가
router.post('/:id/members', async (req: Request, res: Response) => {
  try {
    const { memberId } = req.body;

    if (!memberId) {
      return res.status(400).json({ error: 'memberId is required' });
    }

    const club = await Club.findById(req.params.id);
    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    const member = await Member.findById(memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // 이미 회원인지 확인
    if (club.members.some((m) => m.toString() === memberId)) {
      return res.status(409).json({ error: 'Member already in club' });
    }

    club.members.push(memberId);
    club.memberCount = club.members.length;
    await club.save();

    return res.status(200).json({ message: 'Member added to club', club });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to add member', details: (error as Error).message });
  }
});

// DELETE /api/clubs/:id/members/:memberId - 클럽에서 회원 제거
router.delete('/:id/members/:memberId', async (req: Request, res: Response) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    const memberIndex = club.members.findIndex((m) => m.toString() === req.params.memberId);
    if (memberIndex === -1) {
      return res.status(404).json({ error: 'Member not in club' });
    }

    club.members.splice(memberIndex, 1);
    club.memberCount = club.members.length;
    await club.save();

    return res.status(200).json({ message: 'Member removed from club', club });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to remove member', details: (error as Error).message });
  }
});

// DELETE /api/clubs/:id - 클럽 삭제
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { hard } = req.query;

    if (hard === 'true') {
      const club = await Club.findByIdAndDelete(req.params.id);
      if (!club) {
        return res.status(404).json({ error: 'Club not found' });
      }
      return res.status(200).json({ message: 'Club permanently deleted', club });
    } else {
      const club = await Club.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      );
      if (!club) {
        return res.status(404).json({ error: 'Club not found' });
      }
      return res.status(200).json({ message: 'Club deactivated', club });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete club', details: (error as Error).message });
  }
});

export default router;
